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
	const micContextRef = useRef(null)
	const playbackContextRef = useRef(null)
	const micStreamRef = useRef(null)
	const processorRef = useRef(null)
	const speechRecRef = useRef(null)

	const isMutedRef = useRef(false)
	const isAssistantSpeakingRef = useRef(false)
	const isInCallRef = useRef(false)

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
		isAssistantSpeakingRef.current = false
		setIsAssistantSpeaking(false)
	}, [settings])

	const playNextAudioChunk = useCallback(async () => {
		if (audioQueueRef.current.length === 0) {
			currentAudioSourceRef.current = null
			setTimeout(() => {
				if (audioQueueRef.current.length === 0) {
					isPlayingRef.current = false
					isAssistantSpeakingRef.current = false
					setIsAssistantSpeaking(false)
				}
			}, 300)
			return
		}

		isPlayingRef.current = true
		isAssistantSpeakingRef.current = true
		setIsAssistantSpeaking(true)

		const base64Audio = audioQueueRef.current.shift()
		try {
			const binaryString = atob(base64Audio)
			const len = binaryString.length
			const bytes = new Uint8Array(len)
			for (let i = 0; i < len; i++) {
				bytes[i] = binaryString.charCodeAt(i)
			}

			if (!playbackContextRef.current || playbackContextRef.current.state === "closed") {
				playbackContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
			}
			if (playbackContextRef.current.state === "suspended") {
				await playbackContextRef.current.resume()
			}

			const audioBuffer = await playbackContextRef.current.decodeAudioData(bytes.buffer.slice(0))
			const source = playbackContextRef.current.createBufferSource()
			source.buffer = audioBuffer
			source.connect(playbackContextRef.current.destination)
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

	const endCall = useCallback(() => {
		isInCallRef.current = false
		stopCurrentAudioPlayback()

		if (speechRecRef.current) {
			try {
				speechRecRef.current.onend = null
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

		if (micContextRef.current) {
			try {
				micContextRef.current.close()
			} catch (e) {}
			micContextRef.current = null
		}

		if (playbackContextRef.current) {
			try {
				playbackContextRef.current.close()
			} catch (e) {}
			playbackContextRef.current = null
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

	const startCall = useCallback(async () => {
		try {
			setStatus("connecting")

			let micStream = null
			let micCtx = null
			let processor = null

			if (settings?.useBrowserSTT) {
				const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
				if (!SpeechRec) {
					alert("Tu navegador no soporta SpeechRecognition nativo. Desactiva 'Browser STT' en Configuración.")
					setStatus("disconnected")
					return
				}
			} else {
				if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
					alert("El acceso al micrófono requiere una conexión segura (HTTPS o localhost) o habilitar permisos en el navegador. En Android Chrome puedes habilitarlo en chrome://flags/#unsafely-treat-insecure-origin-as-secure agregando http://" + window.location.host)
					setStatus("error")
					return
				}

				try {
					micStream = await navigator.mediaDevices.getUserMedia({
						audio: {
							channelCount: 1,
							sampleRate: 16000,
							echoCancellation: true,
							noiseSuppression: true,
							autoGainControl: true
						}
					})
					micStreamRef.current = micStream

					micCtx = new (window.AudioContext || window.webkitAudioContext)({
						sampleRate: 16000
					})
					micContextRef.current = micCtx

					const source = micCtx.createMediaStreamSource(micStream)
					processor = micCtx.createScriptProcessor(4096, 1, 1)
					processorRef.current = processor

					// Route through a silent gain node to destination so onaudioprocess runs without acoustic feedback
					const silentGain = micCtx.createGain()
					silentGain.gain.value = 0
					source.connect(processor)
					processor.connect(silentGain)
					silentGain.connect(micCtx.destination)
				} catch (micErr) {
					console.error("Microphone permission/access error:", micErr)
					alert("Error al acceder al micrófono: " + (micErr.message || micErr.name))
					setStatus("error")
					endCall()
					return
				}
			}

			const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
			const host = window.location.host
			const wsUrl = `${protocol}//${host}/ws/call`
			console.log("[VoiceCall] Connecting to WebSocket:", wsUrl)

			const ws = new WebSocket(wsUrl)
			wsRef.current = ws

			ws.onopen = () => {
				console.log("[VoiceCall] WebSocket connected successfully")
				setStatus("connected")
				setIsInCall(true)
				isInCallRef.current = true

				ws.send(JSON.stringify({
					type: "config",
					tts_mode: settings?.useBrowserTTS ? "browser" : "rpi5"
				}))

				if (settings?.useBrowserSTT) {
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
						rec.onend = () => {
							// Android Chrome stops recognition after silence; restart if call is still active
							if (isInCallRef.current && settings?.useBrowserSTT) {
								try {
									rec.start()
								} catch (e) {}
							}
						}
						rec.onerror = (e) => console.error("SpeechRec error:", e)
						rec.start()
						speechRecRef.current = rec
					}
				} else if (processor) {
					processor.onaudioprocess = (e) => {
						if (isMutedRef.current || isAssistantSpeakingRef.current) return
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
							utterance.onstart = () => {
								isAssistantSpeakingRef.current = true
								setIsAssistantSpeaking(true)
							}
							utterance.onend = () => {
								setTimeout(() => {
									isAssistantSpeakingRef.current = false
									setIsAssistantSpeaking(false)
								}, 300)
							}
							utterance.onerror = () => {
								isAssistantSpeakingRef.current = false
								setIsAssistantSpeaking(false)
							}
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

			ws.onclose = (event) => {
				console.warn(`[VoiceCall] WebSocket closed: code=${event.code}, reason=${event.reason || "none"}`)
				endCall()
			}

			ws.onerror = (err) => {
				console.error("[VoiceCall] WebSocket error:", err)
				endCall()
			}
		} catch (err) {
			console.error("[VoiceCall] Failed to start call:", err)
			setStatus("error")
			endCall()
		}
	}, [endCall, enqueueAudioChunk, settings])

	const toggleMute = useCallback(() => {
		setIsMuted((prev) => {
			isMutedRef.current = !prev
			return !prev
		})
	}, [])

	useEffect(() => {
		return () => {
			stopCurrentAudioPlayback()
			if (wsRef.current) {
				try { wsRef.current.close() } catch (e) {}
				wsRef.current = null
			}
			if (micStreamRef.current) {
				try { micStreamRef.current.getTracks().forEach((t) => t.stop()) } catch (e) {}
				micStreamRef.current = null
			}
		}
	}, [stopCurrentAudioPlayback])

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
