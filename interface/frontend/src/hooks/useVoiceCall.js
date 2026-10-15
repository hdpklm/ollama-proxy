import { useState, useRef, useEffect, useCallback } from "react"

export function useVoiceCall(settings = { useBrowserTTS: false, useBrowserSTT: false, allowBargeIn: true }) {
	const [isInCall, setIsInCall] = useState(false)
	const [isMuted, setIsMuted] = useState(false)
	const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false)
	const [userTranscript, setUserTranscript] = useState("")
	const [assistantText, setAssistantText] = useState("")
	const [callHistory, setCallHistory] = useState([])
	const [status, setStatus] = useState("disconnected")

	const wsRef = useRef(null)
	const micContextRef = useRef(null)
	const micStreamRef = useRef(null)
	const processorRef = useRef(null)
	const speechRecRef = useRef(null)

	// Audio playback refs
	const playAudioContextRef = useRef(null)
	const currentSourceRef = useRef(null)

	const isMutedRef = useRef(false)
	const isInCallRef = useRef(false)

	// Audio playback queue
	const audioQueueRef = useRef([])
	const isPlayingRef = useRef(false)

	const stopCurrentAudioPlayback = useCallback(() => {
		if (settings?.useBrowserTTS) {
			window.speechSynthesis?.cancel()
		}
		audioQueueRef.current = []
		if (currentSourceRef.current) {
			try {
				currentSourceRef.current.onended = null
				currentSourceRef.current.stop()
				currentSourceRef.current.disconnect()
			} catch (e) {}
			currentSourceRef.current = null
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
			const playCtx = playAudioContextRef.current
			if (!playCtx) return

			if (playCtx.state === "suspended") {
				await playCtx.resume()
			}

			const binaryString = atob(base64Audio)
			const len = binaryString.length
			const bytes = new Uint8Array(len)
			for (let i = 0; i < len; i++) {
				bytes[i] = binaryString.charCodeAt(i)
			}

			const audioBuffer = await playCtx.decodeAudioData(bytes.buffer.slice(0))
			const source = playCtx.createBufferSource()
			source.buffer = audioBuffer
			source.connect(playCtx.destination)
			currentSourceRef.current = source

			source.onended = () => {
				currentSourceRef.current = null
				playNextAudioChunk()
			}

			source.start(0)
		} catch (err) {
			console.error("Failed to process audio chunk:", err)
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

		if (playAudioContextRef.current) {
			try { playAudioContextRef.current.close() } catch (e) {}
			playAudioContextRef.current = null
		}

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

			const playCtx = new (window.AudioContext || window.webkitAudioContext)()
			playAudioContextRef.current = playCtx
			if (playCtx.state === "suspended") {
				await playCtx.resume()
			}

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
			}

			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				alert("El acceso al micrófono requiere una conexión segura (HTTPS o localhost) o habilitar permisos en el navegador. En Android Chrome puedes habilitarlo en chrome://flags/#unsafely-treat-insecure-origin-as-secure agregando http://" + window.location.host)
				setStatus("error")
				return
			}

			try {
				// Use standard WebRTC constraints for hardware echo cancellation, noise suppression and auto gain
				// Do not constrain sampleRate in getUserMedia as it breaks hardware AEC correlation
				const constraints = {
					audio: {
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true,
						voiceIsolation: true
					}
				}

				micStream = await navigator.mediaDevices.getUserMedia(constraints)
				micStreamRef.current = micStream

				const track = micStream.getAudioTracks()[0]
				console.log("[VoiceCall] Microphone track settings:", track?.getSettings())

				// Downsample cleaned, echo-cancelled audio to 16 kHz for Vosk only
				if (!settings?.useBrowserSTT) {
					micCtx = new (window.AudioContext || window.webkitAudioContext)({
						sampleRate: 16000
					})
					micContextRef.current = micCtx

					const source = micCtx.createMediaStreamSource(micStream)
					processor = micCtx.createScriptProcessor(4096, 1, 1)
					processorRef.current = processor

					// Normalization and speech leveling via DynamicsCompressorNode
					const compressor = micCtx.createDynamicsCompressor()
					compressor.threshold.setValueAtTime(-24, micCtx.currentTime)
					compressor.knee.setValueAtTime(30, micCtx.currentTime)
					compressor.ratio.setValueAtTime(12, micCtx.currentTime)
					compressor.attack.setValueAtTime(0.003, micCtx.currentTime)
					compressor.release.setValueAtTime(0.25, micCtx.currentTime)

					// Route through a silent gain node so onaudioprocess runs without feeding microphone to speakers
					const silentGain = micCtx.createGain()
					silentGain.gain.value = 0

					source.connect(compressor)
					compressor.connect(processor)
					processor.connect(silentGain)
					silentGain.connect(micCtx.destination)
				}
			} catch (micErr) {
				console.error("Microphone permission/access error:", micErr)
				alert("Error al acceder al micrófono: " + (micErr.message || micErr.name))
				setStatus("error")
				endCall()
				return
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
					tts_mode: settings?.useBrowserTTS ? "browser" : "rpi5",
					allow_barge_in: settings?.allowBargeIn !== false
				}))

				if (settings?.useBrowserSTT) {
					const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
					if (SpeechRec) {
						const rec = new SpeechRec()
						rec.lang = "es-ES"
						rec.continuous = true
						rec.interimResults = true
						rec.onresult = (e) => {
							if (settings?.allowBargeIn === false && isPlayingRef.current) return
							for (let i = e.resultIndex; i < e.results.length; ++i) {
								const trans = e.results[i][0].transcript
								setUserTranscript(trans)
								if (settings?.allowBargeIn !== false && trans.trim().length > 1) {
									stopCurrentAudioPlayback()
								}
								if (e.results[i].isFinal && trans.trim()) {
									if (settings?.allowBargeIn !== false) {
										stopCurrentAudioPlayback()
									}
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
						if (isMutedRef.current) return
						if (settings?.allowBargeIn === false && isPlayingRef.current) return
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
						if (settings?.allowBargeIn !== false) {
							stopCurrentAudioPlayback()
						}
						setUserTranscript(msg.text)
						if (msg.is_final !== false) {
							setCallHistory((prev) => [...prev, { role: "user", text: msg.text }])
						}
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
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({
				type: "config",
				tts_mode: settings?.useBrowserTTS ? "browser" : "rpi5",
				allow_barge_in: settings?.allowBargeIn !== false
			}))
		}
	}, [settings?.useBrowserTTS, settings?.allowBargeIn])

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
