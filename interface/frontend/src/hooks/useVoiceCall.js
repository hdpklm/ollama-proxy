import { useState, useRef, useEffect, useCallback } from "react"

const runAcousticCalibration = async (ctx, stream) => {
	return new Promise((resolve) => {
		try {
			if (!ctx || ctx.state === "closed") return resolve(60)
			const osc = ctx.createOscillator()
			const gain = ctx.createGain()
			osc.type = "sine"
			osc.frequency.setValueAtTime(1500, ctx.currentTime)
			gain.gain.setValueAtTime(0.2, ctx.currentTime)
			gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
			osc.connect(gain)
			gain.connect(ctx.destination)

			const startTime = performance.now()
			osc.start()
			osc.stop(ctx.currentTime + 0.08)

			const analyser = ctx.createAnalyser()
			analyser.fftSize = 512
			const src = ctx.createMediaStreamSource(stream)
			src.connect(analyser)

			const timer = setInterval(() => {
				const data = new Uint8Array(analyser.frequencyBinCount)
				analyser.getByteFrequencyData(data)
				const targetBin = Math.round((1500 * 512) / ctx.sampleRate)
				const energy = data[targetBin] || 0
				if (energy > 80 || performance.now() - startTime > 400) {
					clearInterval(timer)
					const delay = Math.max(20, Math.min(300, Math.round(performance.now() - startTime)))
					console.log(`[VoiceCall] Acoustic calibration measured round-trip delay: ${delay}ms`)
					try { src.disconnect() } catch (e) {}
					resolve(delay)
				}
			}, 10)
		} catch (e) {
			console.warn("[VoiceCall] Calibration fallback:", e)
			resolve(60)
		}
	})
}

export function useVoiceCall(settings = { useBrowserTTS: false, useBrowserSTT: false, allowBargeIn: true, aecMode: "native" }) {
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
	const currentAudioRef = useRef(null)

	const isMutedRef = useRef(false)
	const isInCallRef = useRef(false)

	// Audio playback queue
	const audioQueueRef = useRef([])
	const isPlayingRef = useRef(false)

	// Advanced VAD and WASM AEC refs
	const vadInstanceRef = useRef(null)
	const isUserSpeakingVADRef = useRef(false)
	const aec3InstanceRef = useRef(null)

	const stopCurrentAudioPlayback = useCallback(() => {
		if (settings?.useBrowserTTS) {
			window.speechSynthesis?.cancel()
		}
		audioQueueRef.current = []
		if (currentAudioRef.current) {
			try {
				currentAudioRef.current.onended = null
				currentAudioRef.current.onerror = null
				currentAudioRef.current.pause()
				currentAudioRef.current.currentTime = 0
			} catch (e) {}
			currentAudioRef.current = null
		}
		isPlayingRef.current = false
		setIsAssistantSpeaking(false)
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({ type: "playback_status", is_playing: false }))
		}
	}, [settings])

	const playNextAudioChunk = useCallback(async () => {
		if (audioQueueRef.current.length === 0) {
			isPlayingRef.current = false
			setIsAssistantSpeaking(false)
			if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
				wsRef.current.send(JSON.stringify({ type: "playback_status", is_playing: false }))
			}
			return
		}

		isPlayingRef.current = true
		setIsAssistantSpeaking(true)
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({ type: "playback_status", is_playing: true }))
		}

		const base64Audio = audioQueueRef.current.shift()
		try {
			const binaryString = atob(base64Audio)
			const len = binaryString.length
			const bytes = new Uint8Array(len)
			for (let i = 0; i < len; i++) {
				bytes[i] = binaryString.charCodeAt(i)
			}

			// In WASM AEC mode, feed the reference audio to AEC3 analyze
			if (settings?.aecMode === "wasm" && aec3InstanceRef.current && playAudioContextRef.current) {
				try {
					const playCtx = playAudioContextRef.current
					if (playCtx.state === "suspended") await playCtx.resume()
					const audioBuffer = await playCtx.decodeAudioData(bytes.buffer.slice(0))
					const channelData = audioBuffer.getChannelData(0)
					aec3InstanceRef.current.analyze([channelData])
				} catch (decErr) {
					console.warn("[VoiceCall] AEC analyze decode error:", decErr)
				}
			}

			// Play through native HTMLAudioElement so system AEC receives playout reference
			const blob = new Blob([bytes], { type: "audio/wav" })
			const audioUrl = URL.createObjectURL(blob)
			const audio = new Audio(audioUrl)
			currentAudioRef.current = audio

			audio.onended = () => {
				URL.revokeObjectURL(audioUrl)
				currentAudioRef.current = null
				playNextAudioChunk()
			}

			audio.onerror = (err) => {
				console.error("[VoiceCall] Audio chunk play error:", err)
				URL.revokeObjectURL(audioUrl)
				currentAudioRef.current = null
				playNextAudioChunk()
			}

			await audio.play()
		} catch (err) {
			console.error("[VoiceCall] Failed to process audio chunk:", err)
			playNextAudioChunk()
		}
	}, [settings])

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

		if (vadInstanceRef.current) {
			try { vadInstanceRef.current.destroy() } catch (e) {}
			vadInstanceRef.current = null
		}
		isUserSpeakingVADRef.current = false

		if (aec3InstanceRef.current) {
			try { aec3InstanceRef.current.free() } catch (e) {}
			aec3InstanceRef.current = null
		}

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

					// Direct silent connection without aggressive dynamics compression
					const silentGain = micCtx.createGain()
					silentGain.gain.value = 0

					source.connect(processor)
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

			// Initialize Mode 2 (Silero VAD) or Mode 3 (WASM AEC3 + Calibration)
			if (settings?.aecMode === "vad") {
				try {
					const { MicVAD } = await import("@ricky0123/vad-web")
					const vad = await MicVAD.new({
						stream: micStream,
						baseAssetPath: "/vad/",
						onnxWASMBasePath: "/vad/",
						positiveSpeechThreshold: 0.8,
						negativeSpeechThreshold: 0.6,
						minSpeechFrames: 3,
						onSpeechStart: () => {
							isUserSpeakingVADRef.current = true
							if (settings?.allowBargeIn !== false && isPlayingRef.current) {
								stopCurrentAudioPlayback()
							}
						},
						onSpeechEnd: () => {
							isUserSpeakingVADRef.current = false
						}
					})
					vad.start()
					vadInstanceRef.current = vad
					console.log("[VoiceCall] MicVAD initialized successfully (Mode 2)")
				} catch (vadErr) {
					console.warn("[VoiceCall] MicVAD initialization warning:", vadErr)
				}
			} else if (settings?.aecMode === "wasm") {
				try {
					const WebRtcAec3Module = await import("@ennuicastr/webrtcaec3.js")
					const WebRtcAec3 = WebRtcAec3Module.default || WebRtcAec3Module
					const aec3Mod = await WebRtcAec3()
					const aec = new aec3Mod.AEC3(16000, 1, 1)
					aec3InstanceRef.current = aec

					const delayMs = await runAcousticCalibration(playCtx, micStream)
					const delayFrames = Math.round((delayMs / 1000) * 16000)
					if (typeof aec.setAudioBufferDelay === "function") {
						aec.setAudioBufferDelay(delayFrames)
					}
					console.log(`[VoiceCall] WASM AEC3 initialized (Mode 3) with delay: ${delayMs}ms (${delayFrames} frames)`)
				} catch (wasmErr) {
					console.warn("[VoiceCall] WebRtcAec3 initialization warning:", wasmErr)
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

						// In Mode 2 (VAD): gate mic while speaker outputs unless Silero VAD detects user voice
						if (settings?.aecMode === "vad" && isPlayingRef.current && !isUserSpeakingVADRef.current) {
							return
						}

						let inputData = e.inputBuffer.getChannelData(0)

						// In Mode 3 (WASM AEC3): process buffer with AEC3
						if (settings?.aecMode === "wasm" && aec3InstanceRef.current) {
							try {
								const aec = aec3InstanceRef.current
								const sz = aec.processSize([inputData])
								if (sz > 0) {
									const outBuf = [new Float32Array(sz)]
									aec.process(outBuf, [inputData])
									inputData = outBuf[0]
								}
							} catch (aecErr) {
								console.warn("[VoiceCall] AEC3 process error:", aecErr)
							}
						}

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
						if (settings?.allowBargeIn !== false && msg.is_final) {
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
							utterance.onstart = () => {
								setIsAssistantSpeaking(true)
								isPlayingRef.current = true
								if (ws.readyState === WebSocket.OPEN) {
									ws.send(JSON.stringify({ type: "playback_status", is_playing: true }))
								}
							}
							utterance.onend = () => {
								setIsAssistantSpeaking(false)
								isPlayingRef.current = false
								if (ws.readyState === WebSocket.OPEN) {
									ws.send(JSON.stringify({ type: "playback_status", is_playing: false }))
								}
							}
							utterance.onerror = () => {
								setIsAssistantSpeaking(false)
								isPlayingRef.current = false
								if (ws.readyState === WebSocket.OPEN) {
									ws.send(JSON.stringify({ type: "playback_status", is_playing: false }))
								}
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
	}, [endCall, enqueueAudioChunk, settings, stopCurrentAudioPlayback])

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
			if (vadInstanceRef.current) {
				try { vadInstanceRef.current.destroy() } catch (e) {}
				vadInstanceRef.current = null
			}
			if (aec3InstanceRef.current) {
				try { aec3InstanceRef.current.free() } catch (e) {}
				aec3InstanceRef.current = null
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
