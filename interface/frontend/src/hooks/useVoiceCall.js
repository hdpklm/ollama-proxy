import { useState, useRef, useEffect, useCallback } from "react"

export function useVoiceCall(settings = { useBrowserTTS: false, useBrowserSTT: false }) {
	const [isInCall, setIsInCall] = useState(false)
	const [isMuted, setIsMuted] = useState(false)
	const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false)
	const [userTranscript, setUserTranscript] = useState("")
	const [assistantText, setAssistantText] = useState("")
	const [callHistory, setCallHistory] = useState([])
	const [status, setStatus] = useState("disconnected")

	const wsRef = useRef(null)
	const audioContextRef = useRef(null)
	const micStreamRef = useRef(null)
	const processorRef = useRef(null)
	const speechRecRef = useRef(null)

	// Audio playback queue
	const audioQueueRef = useRef([])
	const isPlayingRef = useRef(false)
	const currentAudioSourceRef = useRef(null)

	const stopCurrentAudioPlayback = useCallback(() => {
		if (settings?.useBrowserTTS) {
			window.speechSynthesis?.cancel()
		}
		audioQueueRef.current = []
		if (currentAudioSourceRef.current) {
			try {
				currentAudioSourceRef.current.stop()
			} catch (e) {
				// Ignore if already stopped
			}
			currentAudioSourceRef.current = null
		}
		isPlayingRef.current = false
		setIsAssistantSpeaking(false)
	}, [settings])

	const playNextAudioChunk = useCallback(async () => {
		if (audioQueueRef.current.length === 0) {
			isPlayingRef.current = false
			setIsAssistantSpeaking(false)
			return
		}

		isPlayingRef.current = true
		setIsAssistantSpeaking(true)

		const base64Audio = audioQueueRef.current.shift()
		try {
			const binaryString = atob(base64Audio)
			const len = binaryString.length
			const bytes = new Uint8Array(len)
			for (let i = 0; i < len; i++) {
				bytes[i] = binaryString.charCodeAt(i)
			}

			if (!audioContextRef.current || audioContextRef.current.state === "closed") {
				audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
			}
			if (audioContextRef.current.state === "suspended") {
				await audioContextRef.current.resume()
			}

			const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer.slice(0))
			const source = audioContextRef.current.createBufferSource()
			source.buffer = audioBuffer
			source.connect(audioContextRef.current.destination)
			currentAudioSourceRef.current = source

			source.onended = () => {
				currentAudioSourceRef.current = null
				playNextAudioChunk()
			}

			source.start(0)
		} catch (err) {
			console.error("Failed to decode and play audio chunk:", err)
			playNextAudioChunk()
		}
	}, [])

	const enqueueAudioChunk = useCallback((base64Audio) => {
		audioQueueRef.current.push(base64Audio)
		if (!isPlayingRef.current) {
			playNextAudioChunk()
		}
	}, [playNextAudioChunk])

	const interruptAssistant = useCallback(() => {
		stopCurrentAudioPlayback()
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({ type: "interrupt" }))
		}
	}, [stopCurrentAudioPlayback])

	const startCall = useCallback(async () => {
		try {
			setStatus("connecting")
			const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
			const host = window.location.host
			const wsUrl = `${protocol}//${host}/ws/call`

			const ws = new WebSocket(wsUrl)
			wsRef.current = ws

			ws.onopen = async () => {
				setStatus("connected")
				setIsInCall(true)

				// Inform backend whether to synthesize audio or send text sentences
				ws.send(JSON.stringify({
					type: "config",
					tts_mode: settings?.useBrowserTTS ? "browser" : "rpi5"
				}))

				if (settings?.useBrowserSTT) {
					// Use client-side Web Speech Recognition
					const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
					if (SpeechRec) {
						const rec = new SpeechRec()
						rec.lang = "es-ES"
						rec.continuous = true
						rec.interimResults = true
						rec.onresult = (e) => {
							for (let i = e.resultIndex; i < e.results.length; ++i) {
								const trans = e.results[i][0].transcript
								setUserTranscript(trans)
								if (e.results[i].isFinal && trans.trim()) {
									if (ws.readyState === WebSocket.OPEN) {
										ws.send(JSON.stringify({ type: "user_text", text: trans.trim() }))
									}
								}
							}
						}
						rec.onerror = (e) => console.error("SpeechRec error:", e)
						rec.start()
						speechRecRef.current = rec
					}
				} else {
					// Setup Microphone capture with native Echo Cancellation for RPi5 Vosk
					const stream = await navigator.mediaDevices.getUserMedia({
						audio: {
							channelCount: 1,
							sampleRate: 16000,
							echoCancellation: true,
							noiseSuppression: true,
							autoGainControl: true
						}
					})
					micStreamRef.current = stream

					const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
						sampleRate: 16000
					})
					audioContextRef.current = audioCtx

					const source = audioCtx.createMediaStreamSource(stream)
					const processor = audioCtx.createScriptProcessor(4096, 1, 1)
					processorRef.current = processor

					processor.onaudioprocess = (e) => {
						if (isMuted) return
						const inputData = e.inputBuffer.getChannelData(0)

						const pcm16 = new Int16Array(inputData.length)
						for (let i = 0; i < inputData.length; i++) {
							const s = Math.max(-1, Math.min(1, inputData[i]))
							pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
						}

						if (ws.readyState === WebSocket.OPEN) {
							ws.send(pcm16.buffer)
						}
					}

					source.connect(processor)
					processor.connect(audioCtx.destination)
				}
			}

			ws.onmessage = (event) => {
				try {
					const msg = JSON.parse(event.data)
					if (msg.type === "user_transcript") {
						setUserTranscript(msg.text)
						setCallHistory((prev) => [...prev, { role: "user", text: msg.text }])
					} else if (msg.type === "assistant_thinking") {
						setAssistantText("...")
					} else if (msg.type === "assistant_token") {
						setAssistantText((prev) => (prev === "..." ? msg.token : prev + msg.token))
					} else if (msg.type === "assistant_sentence") {
						if (settings?.useBrowserTTS && msg.text) {
							const utterance = new SpeechSynthesisUtterance(msg.text)
							utterance.lang = "es-ES"
							utterance.onstart = () => setIsAssistantSpeaking(true)
							utterance.onend = () => setIsAssistantSpeaking(false)
							utterance.onerror = () => setIsAssistantSpeaking(false)
							window.speechSynthesis?.speak(utterance)
						}
					} else if (msg.type === "assistant_audio_chunk") {
						if (!settings?.useBrowserTTS) {
							enqueueAudioChunk(msg.audio_base64)
						}
					} else if (msg.type === "assistant_done") {
						setCallHistory((prev) => [...prev, { role: "assistant", text: msg.full_text }])
					}
				} catch (err) {
					console.error("WS parse error:", err)
				}
			}

			ws.onclose = () => {
				endCall()
			}

			ws.onerror = (err) => {
				console.error("WS error:", err)
				endCall()
			}
		} catch (err) {
			console.error("Failed to start call:", err)
			setStatus("error")
			endCall()
		}
	}, [enqueueAudioChunk, isMuted, settings])

	const endCall = useCallback(() => {
		stopCurrentAudioPlayback()

		if (speechRecRef.current) {
			try {
				speechRecRef.current.stop()
			} catch (e) {}
			speechRecRef.current = null
		}

		if (micStreamRef.current) {
			micStreamRef.current.getTracks().forEach((track) => track.stop())
			micStreamRef.current = null
		}

		if (processorRef.current) {
			try {
				processorRef.current.disconnect()
			} catch (e) {}
			processorRef.current = null
		}

		if (audioContextRef.current) {
			try {
				audioContextRef.current.close()
			} catch (e) {}
			audioContextRef.current = null
		}

		if (wsRef.current) {
			try {
				wsRef.current.close()
			} catch (e) {}
			wsRef.current = null
		}

		setIsInCall(false)
		setStatus("disconnected")
		setUserTranscript("")
		setAssistantText("")
	}, [stopCurrentAudioPlayback])

	const toggleMute = useCallback(() => {
		setIsMuted((prev) => !prev)
	}, [])

	useEffect(() => {
		return () => {
			endCall()
		}
	}, [endCall])

	return {
		isInCall,
		isMuted,
		isAssistantSpeaking,
		userTranscript,
		assistantText,
		callHistory,
		status,
		startCall,
		endCall,
		toggleMute,
		interruptAssistant
	}
}
