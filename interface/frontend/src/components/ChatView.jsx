import React, { useState, useRef, useEffect } from "react"
import { Send, Mic, Square, Play, Pause, Loader2, Bot, User, Volume2, VolumeX, Activity, Wrench, ChevronDown, ChevronUp, Cpu, Terminal, Clock, Database, Zap, Layers, CheckCircle2, PlusCircle } from "lucide-react"
const formatModelName = (name) => {
	if (!name) return "gemma4:e2b"
	if (name.startsWith("sha256-") || name.startsWith("sha256:")) {
		const clean = name.replace(/^sha256[:-]/, "")
		return `gemma4 (${clean.slice(0, 6)}...${clean.slice(-4)})`
	}
	return name
}

export default function ChatView({ settings = { useBrowserTTS: false, useBrowserSTT: false } }) {
	const [chatSessionId, setChatSessionId] = useState(() => {
		const saved = typeof window !== "undefined" ? sessionStorage.getItem("current_chat_session_id") : null
		if (saved) return saved
		const newId = "chat_" + Date.now().toString() + "_" + Math.random().toString(36).substring(2, 7)
		if (typeof window !== "undefined") sessionStorage.setItem("current_chat_session_id", newId)
		return newId
	})
	const [messages, setMessages] = useState([
		{
			role: "assistant",
			content: "Hola, ¿en qué puedo ayudarte hoy?"
		}
	])
	const [input, setInput] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [isRecording, setIsRecording] = useState(false)
	const [playingIndex, setPlayingIndex] = useState(null)
	const [audioLoadingIndex, setAudioLoadingIndex] = useState(null)
	const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false)
	const [openMetricsIndices, setOpenMetricsIndices] = useState({})
	const [ttsEnabled, setTtsEnabled] = useState(false)
	const [modelStatus, setModelStatus] = useState("Cargando modelo")
	const [stepElapsedSeconds, setStepElapsedSeconds] = useState("0.0")
	const stepStartTimeRef = useRef(Date.now())

	const updateModelStatus = (statusText) => {
		if (!statusText) return
		stepStartTimeRef.current = Date.now()
		setStepElapsedSeconds("0.0")
		setModelStatus(statusText)
	}

	useEffect(() => {
		let interval = null
		if (isLoading) {
			interval = setInterval(() => {
				const elapsed = ((Date.now() - stepStartTimeRef.current) / 1000).toFixed(1)
				setStepElapsedSeconds(elapsed)
			}, 100)
		} else {
			setStepElapsedSeconds("0.0")
		}
		return () => {
			if (interval) clearInterval(interval)
		}
	}, [isLoading, modelStatus])

	const formatThreeWords = (text) => {
		if (!text) return "Cargando modelo"
		const words = text.trim().split(/\s+/)
		return words.slice(0, 3).join(" ")
	}

	const handleNewChat = () => {
		stopStreamingAudio()
		const newId = "chat_" + Date.now().toString() + "_" + Math.random().toString(36).substring(2, 7)
		if (typeof window !== "undefined") sessionStorage.setItem("current_chat_session_id", newId)
		setChatSessionId(newId)
		setMessages([
			{
				role: "assistant",
				content: "Hola, ¿en qué puedo ayudarte hoy?"
			}
		])
	}

	const toggleMetrics = (index) => {
		setOpenMetricsIndices((prev) => ({
			...prev,
			[index]: !prev[index]
		}))
	}

	const messagesEndRef = useRef(null)
	const speechRecRef = useRef(null)
	const chatWsRef = useRef(null)
	const chatMicStreamRef = useRef(null)
	const chatMicContextRef = useRef(null)
	const chatProcessorRef = useRef(null)
	const currentAudioRef = useRef(null)
	const audioCacheRef = useRef({})
	const committedTextRef = useRef("")
	const streamWsRef = useRef(null)
	const metricsWsRef = useRef(null)

	// Streaming Audio Playback Refs
	const playAudioContextRef = useRef(null)
	const currentSourceRef = useRef(null)
	const audioQueueRef = useRef([])
	const isAudioQueuePlayingRef = useRef(false)
	const browserTtsQueueRef = useRef([])
	const isBrowserTtsPlayingRef = useRef(false)

	const stopStreamingAudio = () => {
		audioQueueRef.current = []
		browserTtsQueueRef.current = []
		if (window.speechSynthesis) {
			window.speechSynthesis.cancel()
		}
		if (metricsWsRef.current) {
			try { metricsWsRef.current.close() } catch (e) {}
			metricsWsRef.current = null
		}
		if (currentSourceRef.current) {
			try {
				currentSourceRef.current.onended = null
				currentSourceRef.current.stop()
				currentSourceRef.current.disconnect()
			} catch (e) {}
			currentSourceRef.current = null
		}
		isAudioQueuePlayingRef.current = false
		isBrowserTtsPlayingRef.current = false
		setIsAssistantSpeaking(false)
	}

	const playNextAudioChunk = async () => {
		if (audioQueueRef.current.length === 0) {
			isAudioQueuePlayingRef.current = false
			setIsAssistantSpeaking(false)
			return
		}

		isAudioQueuePlayingRef.current = true
		setIsAssistantSpeaking(true)

		const base64Audio = audioQueueRef.current.shift()
		try {
			let playCtx = playAudioContextRef.current
			if (!playCtx || playCtx.state === "closed") {
				playCtx = new (window.AudioContext || window.webkitAudioContext)()
				playAudioContextRef.current = playCtx
			}

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
	}

	const enqueueAudioChunk = (base64Audio) => {
		audioQueueRef.current.push(base64Audio)
		if (!isAudioQueuePlayingRef.current) {
			playNextAudioChunk()
		}
	}

	const playNextBrowserTts = () => {
		if (browserTtsQueueRef.current.length === 0) {
			isBrowserTtsPlayingRef.current = false
			setIsAssistantSpeaking(false)
			return
		}

		isBrowserTtsPlayingRef.current = true
		setIsAssistantSpeaking(true)
		const text = browserTtsQueueRef.current.shift()
		const utterance = new SpeechSynthesisUtterance(text)
		utterance.lang = "es-ES"
		utterance.onend = () => {
			playNextBrowserTts()
		}
		utterance.onerror = () => {
			playNextBrowserTts()
		}
		window.speechSynthesis?.speak(utterance)
	}

	const enqueueBrowserTts = (text) => {
		browserTtsQueueRef.current.push(text)
		if (!isBrowserTtsPlayingRef.current) {
			playNextBrowserTts()
		}
	}

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [messages, isLoading])

	const fallbackFetchChat = async (history) => {
		try {
			const res = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ messages: history, session_id: chatSessionId })
			})
			if (!res.ok) throw new Error("Failed to contact LLM")
			const data = await res.json()
			const assistantContent = data.message?.content || data.response || "No response"
			const toolsUsed = data.tools_used || []
			const usageData = data.usage || (data.prompt_tokens !== undefined ? {
				prompt_tokens: data.prompt_tokens,
				completion_tokens: data.completion_tokens,
				total_tokens: (data.prompt_tokens || 0) + (data.completion_tokens || 0),
				prompt_tokens_per_second: data.prompt_token_s || data.prompt_tokens_per_second,
				tokens_per_second: data.generate_token_s || data.tokens_per_second
			} : null)
			setMessages((prev) => {
				const last = prev[prev.length - 1]
				const newMsg = {
					role: "assistant",
					content: assistantContent,
					tools_used: toolsUsed,
					usage: usageData,
					priority: data.priority,
					times_paused: data.times_paused,
					kv_cache_ram_mb: data.kv_cache_ram_mb
				}
				if (last && last.role === "assistant") {
					return [...prev.slice(0, -1), newMsg]
				}
				return [...prev, newMsg]
			})
		} catch (err) {
			console.error("Chat error:", err)
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: "Error al comunicarse con el modelo." }
			])
		} finally {
			setIsLoading(false)
		}
	}

	const handleSend = async (textToSend) => {
		stopStreamingAudio()
		if (isRecording) {
			stopVoiceRecording()
		}
		const text = (textToSend || input).trim()
		if (!text || isLoading) return

		if (!settings.useBrowserTTS) {
			try {
				if (!playAudioContextRef.current || playAudioContextRef.current.state === "closed") {
					playAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
				}
				if (playAudioContextRef.current.state === "suspended") {
					playAudioContextRef.current.resume()
				}
			} catch (e) {}
		}

		const newHistory = [...messages, { role: "user", content: text }]
		setMessages(newHistory)
		setInput("")
		setIsLoading(true)
		updateModelStatus("Cargando modelo")

		try {
			const turnId = Date.now().toString() + "_" + Math.random().toString(36).substring(2, 7)
			const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"

			let accumulatedText = ""
			let currentModelMetrics = null
			let currentKvMetrics = null
			let currentPromptMetrics = null
			let currentGenMetrics = null
			let currentToolsMetrics = []
			let currentSubAgentsMetrics = []

			// 1. WebSocket 2 (No-streaming): Métricas y Resultados de Etapas
			const metricsWsUrl = `${protocol}//${window.location.host}/ws/chat/metrics?turn_id=${turnId}`
			const metricsWs = new WebSocket(metricsWsUrl)
			metricsWsRef.current = metricsWs

			metricsWs.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data)
					if (data.type === "metric") {
						if (data.stage === "model_load") {
							updateModelStatus("Cargando modelo")
							currentModelMetrics = {
								model: data.model,
								load_time_seconds: data.load_time_seconds,
								in_memory: data.in_memory,
								details: data.details
							}
						} else if (data.stage === "kv_cache") {
							updateModelStatus("Montando cache")
							currentKvMetrics = {
								restore_time_seconds: data.restore_time_seconds,
								ram_mb: data.ram_mb,
								is_cached: data.is_cached,
								details: data.details
							}
						} else if (data.stage === "prompt_execution") {
							updateModelStatus("Evaluando prompt")
							currentPromptMetrics = {
								tokens: data.tokens,
								duration_seconds: data.duration_seconds,
								tokens_per_second: data.tokens_per_second
							}
						} else if (data.stage === "tool_execution") {
							const tName = (data.tool || "").toLowerCase()
							if (tName.includes("search")) {
								updateModelStatus("Buscando en web")
							} else if (tName.includes("url") || tName.includes("read")) {
								updateModelStatus("Leyendo página web")
							} else if (tName.includes("pdf")) {
								updateModelStatus("Analizando archivo PDF")
							} else if (tName.includes("researcher") || tName.includes("agent")) {
								updateModelStatus("Consultando subagente")
							} else {
								updateModelStatus("Ejecutando herramienta")
							}
							currentToolsMetrics = [
								...currentToolsMetrics,
								{
									tool: data.tool,
									args: data.args,
									duration_seconds: data.duration_seconds,
									call_tokens: data.call_tokens,
									result_tokens: data.result_tokens,
									total_tokens: data.total_tokens,
									step: data.step
								}
							]
						} else if (data.stage === "sub_agent") {
							updateModelStatus("Consultando subagente")
							currentSubAgentsMetrics = [
								...currentSubAgentsMetrics,
								{
									name: data.name,
									model: data.model,
									model_load_time_seconds: data.model_load_time_seconds,
									duration_seconds: data.duration_seconds,
									prompt_tokens: data.prompt_tokens,
									prompt_eval_seconds: data.prompt_eval_seconds,
									prompt_tps: data.prompt_tps,
									completion_tokens: data.completion_tokens,
									generation_seconds: data.generation_seconds,
									generation_tps: data.generation_tps,
									total_tokens: data.total_tokens,
									kv_restore_time_seconds: data.kv_restore_time_seconds,
									kv_cache_ram_mb: data.kv_cache_ram_mb
								}
							]
						} else if (data.stage === "generation_metrics") {
							updateModelStatus("Generando respuesta")
							currentGenMetrics = {
								tokens: data.tokens,
								duration_seconds: data.duration_seconds,
								tokens_per_second: data.tokens_per_second,
								total_tokens: data.total_tokens,
								kv_cache_ram_mb: data.kv_cache_ram_mb,
								priority: data.priority,
								times_paused: data.times_paused,
								total_turn_seconds: data.total_turn_seconds
							}
						}

						// Update live message with telemetry from WebSocket 2
						setMessages((prev) => {
							const last = prev[prev.length - 1]
							if (last && last.role === "assistant") {
								return [
									...prev.slice(0, -1),
									{
										...last,
										model_metrics: currentModelMetrics || last.model_metrics,
										kv_metrics: currentKvMetrics || last.kv_metrics,
										prompt_metrics: currentPromptMetrics || last.prompt_metrics,
										generation_metrics: currentGenMetrics || last.generation_metrics,
										tools_metrics: currentToolsMetrics.length > 0 ? currentToolsMetrics : last.tools_metrics,
										subagents_metrics: currentSubAgentsMetrics.length > 0 ? currentSubAgentsMetrics : last.subagents_metrics
									}
								]
							}
							return prev
						})
					} else if (data.type === "metrics_done") {
						if (data.total_turn_seconds !== undefined) {
							setMessages((prev) => {
								const last = prev[prev.length - 1]
								if (last && last.role === "assistant") {
									return [
										...prev.slice(0, -1),
										{
											...last,
											total_turn_seconds: data.total_turn_seconds
										}
									]
								}
								return prev
							})
						}
						try { metricsWs.close() } catch (e) {}
						metricsWsRef.current = null
					}
				} catch (e) {
					console.error("Metrics WS parse error:", e)
				}
			}

			metricsWs.onerror = (err) => {
				console.warn("Metrics WS error:", err)
			}

			// 2. WebSocket 1 (Streaming ultra-rápido): Tokens en tiempo real y audio TTS
			const streamWsUrl = `${protocol}//${window.location.host}/ws/chat?turn_id=${turnId}`
			const ws = new WebSocket(streamWsUrl)
			streamWsRef.current = ws

			ws.onopen = () => {
				const firstUserIdx = newHistory.findIndex((m) => m.role === "user")
				const historyToSend = firstUserIdx > 0 ? newHistory.slice(firstUserIdx) : newHistory
				ws.send(JSON.stringify({
					turn_id: turnId,
					session_id: chatSessionId,
					messages: historyToSend,
					tts_mode: ttsEnabled ? (settings.useBrowserTTS ? "browser" : "rpi5") : "none"
				}))
			}

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data)
					if (data.type === "status" && data.status) {
						updateModelStatus(data.status)
					} else if (data.type === "thinking_token") {
						updateModelStatus("Razonando respuesta")
					} else if (data.type === "assistant_status" && data.status) {
						const rawStatus = data.status || ""
						if (rawStatus.toLowerCase().includes("buscando")) {
							updateModelStatus("Buscando en web")
						} else if (rawStatus.toLowerCase().includes("leyendo")) {
							updateModelStatus("Leyendo página web")
						} else if (rawStatus.toLowerCase().includes("pdf") || rawStatus.toLowerCase().includes("analizando")) {
							updateModelStatus("Analizando archivo PDF")
						} else {
							const words = rawStatus.trim().split(/\s+/)
							updateModelStatus(words.slice(0, 3).join(" "))
						}
					} else if (data.type === "token" && data.token) {
						updateModelStatus("Generando respuesta")
						accumulatedText += data.token
						setMessages((prev) => {
							const last = prev[prev.length - 1]
							const newMsg = {
								role: "assistant",
								content: accumulatedText,
								model_metrics: currentModelMetrics,
								kv_metrics: currentKvMetrics,
								prompt_metrics: currentPromptMetrics,
								generation_metrics: currentGenMetrics,
								tools_metrics: currentToolsMetrics,
								subagents_metrics: currentSubAgentsMetrics,
								tools_used: currentToolsMetrics
							}
							if (last && last.role === "assistant") {
								return [...prev.slice(0, -1), { ...last, content: accumulatedText }]
							} else {
								return [...prev, newMsg]
							}
						})
					} else if (data.type === "audio_chunk" && data.audio_base64) {
						enqueueAudioChunk(data.audio_base64)
					} else if (data.type === "tts_sentence" && data.text) {
						enqueueBrowserTts(data.text)
					} else if (data.type === "done") {
						const finalTools = (data.tools_used && data.tools_used.length > 0) ? data.tools_used : currentToolsMetrics

						setMessages((prev) => {
							const last = prev[prev.length - 1]
							if (last && last.role === "assistant") {
								return [
									...prev.slice(0, -1),
									{
										...last,
										content: accumulatedText || last.content,
										tools_used: finalTools,
										tools_metrics: currentToolsMetrics.length > 0 ? currentToolsMetrics : finalTools,
										model_metrics: currentModelMetrics || last.model_metrics,
										kv_metrics: currentKvMetrics || last.kv_metrics,
										prompt_metrics: currentPromptMetrics || last.prompt_metrics,
										generation_metrics: currentGenMetrics || last.generation_metrics,
										subagents_metrics: currentSubAgentsMetrics.length > 0 ? currentSubAgentsMetrics : last.subagents_metrics,
										usage: data.usage || last.usage,
										priority: data.priority ?? last.priority,
										times_paused: data.times_paused ?? last.times_paused,
										kv_cache_ram_mb: data.kv_cache_ram_mb ?? last.kv_cache_ram_mb,
										total_turn_seconds: data.total_turn_seconds ?? currentGenMetrics?.total_turn_seconds ?? last.total_turn_seconds
									}
								]
							}
							return prev
						})
						setIsLoading(false)
						try { ws.close() } catch (e) {}
						streamWsRef.current = null
					} else if (data.type === "error") {
						console.error("Chat WS stream error:", data.message)
						setMessages((prev) => [
							...prev,
							{ role: "assistant", content: `Error: ${data.message}` }
						])
						setIsLoading(false)
						try { ws.close() } catch (e) {}
						streamWsRef.current = null
					}
				} catch (e) {
					console.error("WS chat parse error:", e)
				}
			}

			ws.onerror = (err) => {
				console.error("Chat WS error, falling back to HTTP:", err)
				fallbackFetchChat(newHistory)
			}

			ws.onclose = () => {
				setIsLoading(false)
				streamWsRef.current = null
			}
		} catch (err) {
			console.error("Error creating chat WS:", err)
			fallbackFetchChat(newHistory)
		}
	}

	const handlePlayTTS = async (text, index) => {
		if (playingIndex === index) {
			if (settings.useBrowserTTS) {
				window.speechSynthesis?.cancel()
			} else if (currentAudioRef.current) {
				currentAudioRef.current.pause()
				currentAudioRef.current = null
			}
			setPlayingIndex(null)
			return
		}

		if (settings.useBrowserTTS) {
			window.speechSynthesis?.cancel()
			if (currentAudioRef.current) {
				currentAudioRef.current.pause()
				currentAudioRef.current = null
			}

			const utterance = new SpeechSynthesisUtterance(text)
			utterance.lang = "es-ES"
			utterance.onend = () => setPlayingIndex(null)
			utterance.onerror = () => setPlayingIndex(null)
			window.speechSynthesis?.speak(utterance)
			setPlayingIndex(index)
			return
		}

		if (currentAudioRef.current) {
			currentAudioRef.current.pause()
			currentAudioRef.current = null
			setPlayingIndex(null)
		}

		try {
			let audioBlob = audioCacheRef.current[index]

			if (!audioBlob) {
				setAudioLoadingIndex(index)
				const res = await fetch("/api/tts", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ text })
				})
				if (!res.ok) throw new Error("Failed to synthesize audio")
				audioBlob = await res.blob()
				audioCacheRef.current[index] = audioBlob
			}

			const audioUrl = URL.createObjectURL(audioBlob)
			const audio = new Audio(audioUrl)
			currentAudioRef.current = audio

			audio.onended = () => {
				setPlayingIndex(null)
				currentAudioRef.current = null
			}

			audio.onerror = () => {
				setPlayingIndex(null)
				currentAudioRef.current = null
			}

			await audio.play()
			setPlayingIndex(index)
		} catch (err) {
			console.error("TTS playback error:", err)
		} finally {
			setAudioLoadingIndex(null)
		}
	}

	const startVoiceRecording = async () => {
		stopStreamingAudio()
		committedTextRef.current = input ? input.trim() + " " : ""
		if (settings.useBrowserSTT) {
			const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
			if (!SpeechRec) {
				alert("Tu navegador no soporta SpeechRecognition nativo.")
				return
			}
			try {
				const rec = new SpeechRec()
				rec.lang = "es-ES"
				rec.continuous = true
				rec.interimResults = true
				rec.onresult = (e) => {
					let fullTranscript = ""
					for (let i = 0; i < e.results.length; ++i) {
						fullTranscript += e.results[i][0].transcript
					}
					if (fullTranscript.trim()) {
						setInput((committedTextRef.current + fullTranscript.trim()).trim())
					}
				}
				rec.onend = () => setIsRecording(false)
				rec.onerror = (err) => {
					console.error("SpeechRec error:", err)
					setIsRecording(false)
				}
				speechRecRef.current = rec
				rec.start()
				setIsRecording(true)
			} catch (e) {
				console.error("SpeechRec start error:", e)
			}
			return
		}

		try {
			const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
			const wsUrl = `${protocol}//${window.location.host}/ws/stt`
			const ws = new WebSocket(wsUrl)
			chatWsRef.current = ws

			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			})
			chatMicStreamRef.current = stream

			const micCtx = new (window.AudioContext || window.webkitAudioContext)({
				sampleRate: 16000
			})
			chatMicContextRef.current = micCtx

			const source = micCtx.createMediaStreamSource(stream)
			const processor = micCtx.createScriptProcessor(4096, 1, 1)
			chatProcessorRef.current = processor

			const silentGain = micCtx.createGain()
			silentGain.gain.value = 0

			source.connect(processor)
			processor.connect(silentGain)
			silentGain.connect(micCtx.destination)

			processor.onaudioprocess = (e) => {
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

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data)
					if (data.type === "transcript" && data.text) {
						const currentFull = (committedTextRef.current + data.text).trim()
						setInput(currentFull)
						if (data.is_final) {
							committedTextRef.current = currentFull + " "
						}
					}
				} catch (e) {
					console.error("STT parse error:", e)
				}
			}

			ws.onerror = (err) => {
				console.error("[Chat STT WS error]", err)
				stopVoiceRecording()
			}

			ws.onclose = () => {
				setIsRecording(false)
			}

			setIsRecording(true)
		} catch (err) {
			console.error("Microphone access denied:", err)
			alert("Error al acceder al micrófono: " + (err.message || err.name))
			stopVoiceRecording()
		}
	}

	const stopVoiceRecording = () => {
		setIsRecording(false)
		if (speechRecRef.current) {
			try {
				speechRecRef.current.onend = null
				speechRecRef.current.stop()
			} catch (e) {}
			speechRecRef.current = null
		}
		if (chatProcessorRef.current) {
			try { chatProcessorRef.current.disconnect() } catch (e) {}
			chatProcessorRef.current = null
		}
		if (chatMicContextRef.current) {
			try { chatMicContextRef.current.close() } catch (e) {}
			chatMicContextRef.current = null
		}
		if (chatMicStreamRef.current) {
			try { chatMicStreamRef.current.getTracks().forEach((t) => t.stop()) } catch (e) {}
			chatMicStreamRef.current = null
		}
		if (chatWsRef.current) {
			try {
				if (chatWsRef.current.readyState === WebSocket.OPEN) {
					chatWsRef.current.send(JSON.stringify({ type: "stop" }))
				}
				chatWsRef.current.close()
			} catch (e) {}
			chatWsRef.current = null
		}
	}

	useEffect(() => {
		return () => {
			stopVoiceRecording()
			stopStreamingAudio()
			if (playAudioContextRef.current) {
				try { playAudioContextRef.current.close() } catch (e) {}
				playAudioContextRef.current = null
			}
			if (streamWsRef.current) {
				try { streamWsRef.current.close() } catch (e) {}
				streamWsRef.current = null
			}
			if (metricsWsRef.current) {
				try { metricsWsRef.current.close() } catch (e) {}
				metricsWsRef.current = null
			}
		}
	}, [])

	return (
		<div className="flex flex-col h-full max-w-3xl mx-auto px-3 sm:px-4 py-2.5 sm:py-4 min-h-0 overflow-hidden">
			{/* Chat Session Bar */}
			<div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60 flex-shrink-0">
				<span className="text-[11px] text-slate-500 font-mono truncate">
					ID: {chatSessionId.length > 20 ? chatSessionId.substring(0, 18) + "..." : chatSessionId}
				</span>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => {
							stopStreamingAudio()
							setTtsEnabled((prev) => !prev)
						}}
						className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
							ttsEnabled
								? "bg-sky-950/60 border-sky-800/80 text-sky-400"
								: "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
						}`}
						title={ttsEnabled ? "Voz activada (clic para silenciar y responder ultra rápido)" : "Sin voz / Silenciado (máxima velocidad sin sintetizador)"}
					>
						{ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
						<span>{ttsEnabled ? "Voz activa" : "Sin voz"}</span>
					</button>
					<button
						type="button"
						onClick={handleNewChat}
						className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-colors"
						title="Iniciar nueva conversación limpia"
					>
						<PlusCircle className="w-3.5 h-3.5 text-sky-400" />
						<span>Nuevo chat</span>
					</button>
				</div>
			</div>

			{/* Messages Container */}
			<div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
				{messages.map((msg, index) => (
					<div
						key={index}
						className={`flex items-start gap-3 ${
							msg.role === "user" ? "justify-end" : "justify-start"
						}`}
					>
						{msg.role === "assistant" && (
							<div className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
								<Bot className="w-4 h-4" />
							</div>
						)}

						<div
							className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-md ${
								msg.role === "user"
									? "bg-sky-600 text-white rounded-br-none"
									: "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none"
							}`}
						>
							{!msg.content && isLoading && index === messages.length - 1 ? (
								<div className="flex flex-col gap-1.5 py-0.5">
									<div className="flex items-center gap-2">
										<Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
										<span className="text-xs font-medium text-slate-300">Thinking...</span>
									</div>
									<div className="text-[11px] text-sky-400 font-medium tracking-wide flex items-center gap-1.5 pl-5">
										<span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
										<span>{formatThreeWords(modelStatus)}</span>
										<span className="text-[10px] text-slate-400 font-mono font-normal">({stepElapsedSeconds}s)</span>
									</div>
								</div>
							) : (
								<p className="text-sm leading-relaxed whitespace-pre-wrap">
									{msg.content}
									{isLoading && index === messages.length - 1 && msg.role === "assistant" && (
										<span className="inline-block w-1.5 h-4 ml-1 bg-sky-400 animate-pulse align-middle" />
									)}
								</p>
							)}

							{msg.role === "assistant" && (
								<div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-col gap-2">
									<div className="flex items-center gap-2 flex-wrap">
										{isAssistantSpeaking && index === messages.length - 1 ? (
											<button
												onClick={stopStreamingAudio}
												className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-600/20 text-rose-400 border border-rose-500/40 hover:bg-rose-600/30 transition-colors animate-pulse"
												title="Silenciar voz del asistente"
											>
												<VolumeX className="w-3.5 h-3.5" />
												<span>Silenciar</span>
											</button>
										) : (!isLoading || index !== messages.length - 1) && (
											<button
												onClick={() => handlePlayTTS(msg.content, index)}
												disabled={audioLoadingIndex === index}
												className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
												title="Play response audio"
											>
												{audioLoadingIndex === index ? (
													<Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
												) : playingIndex === index ? (
													<Pause className="w-3.5 h-3.5 text-sky-400" />
												) : (
													<Volume2 className="w-3.5 h-3.5" />
												)}
												<span>
													{audioLoadingIndex === index
														? "Generating..."
														: playingIndex === index
														? "Pause"
														: "Listen"}
												</span>
											</button>
										)}

										{(msg.total_turn_seconds || msg.generation_metrics?.total_turn_seconds || msg.generation_metrics?.duration_seconds) && (
											<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-slate-300 bg-slate-800/90 rounded-lg border border-slate-700/60 shadow-sm" title="Tiempo de respuesta actual de este turno">
												<Clock className="w-3.5 h-3.5 text-sky-400" />
												<span>{msg.total_turn_seconds ?? msg.generation_metrics?.total_turn_seconds ?? msg.generation_metrics?.duration_seconds}s</span>
											</span>
										)}

										<button
											onClick={() => toggleMetrics(index)}
											className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border ${
												openMetricsIndices[index]
													? "bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm"
													: "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/60"
											}`}
											title="Ver herramientas y velocidad de generación"
										>
											<Activity className="w-3.5 h-3.5 text-sky-400" />
											<span>Métricas</span>
											{msg.tools_used && msg.tools_used.length > 0 && (
												<span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
													<Wrench className="w-2.5 h-2.5 mr-1" />
													{msg.tools_used.length}
												</span>
											)}
											{openMetricsIndices[index] ? (
												<ChevronUp className="w-3 h-3 text-slate-400" />
											) : (
												<ChevronDown className="w-3 h-3 text-slate-400" />
											)}
										</button>
									</div>

									{openMetricsIndices[index] && (
										<div className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 space-y-2.5 shadow-xl">
											{/* Top HUD Bar: Modelo, Estado de Memoria y Planificador */}
											<div className="bg-slate-900/80 border border-slate-800/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between flex-wrap gap-2 text-[11px]">
												<div className="flex items-center gap-2">
													<Database className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
													<span className="font-mono text-sky-300 font-semibold truncate max-w-[240px] sm:max-w-none" title={msg.model_metrics?.model || "gemma4:e2b"}>
														{formatModelName(msg.model_metrics?.model || "gemma4:e2b")}
													</span>
													<span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium border ${
														msg.model_metrics?.in_memory !== false
															? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
															: "bg-amber-500/15 text-amber-300 border-amber-500/30"
													}`}>
														<CheckCircle2 className="w-2.5 h-2.5 mr-1" />
														{msg.model_metrics?.in_memory !== false ? "RAM (mmap)" : "Cargando"}
													</span>
												</div>
												<div className="flex items-center gap-2.5 text-[10px] text-slate-400 font-mono">
													<span className="inline-flex items-center gap-1">
														<span className={`w-1.5 h-1.5 rounded-full ${msg.priority ?? msg.generation_metrics?.priority ? "bg-amber-400" : "bg-sky-400"}`} />
														{msg.priority ?? msg.generation_metrics?.priority ? "Prioridad Alta" : "Prioridad Normal"}
													</span>
													{(msg.times_paused ?? msg.generation_metrics?.times_paused) > 0 && (
														<span className="text-amber-400">({msg.times_paused ?? msg.generation_metrics?.times_paused} pausas)</span>
													)}
													<span className="text-slate-500">|</span>
													<span className="text-slate-300 flex items-center gap-1">
														<Clock className="w-3 h-3 text-slate-400" />
														Turno: <strong className="text-sky-300">{msg.total_turn_seconds !== undefined ? `${msg.total_turn_seconds}s` : (msg.generation_metrics?.total_turn_seconds !== undefined ? `${msg.generation_metrics.total_turn_seconds}s` : (msg.generation_metrics?.duration_seconds ? `${msg.generation_metrics.duration_seconds}s` : "-"))}</strong>
													</span>
												</div>
											</div>

											{/* Compact 3-Column Metrics HUD Grid */}
											<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
												{/* Col 1: Evaluación de Prompt (Input) */}
												<div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-2 flex flex-col justify-between">
													<div className="flex items-center justify-between text-slate-300 mb-1">
														<span className="flex items-center gap-1 font-semibold text-[11px]">
															<Zap className="w-3 h-3 text-amber-400" />
															Prompt (Input)
														</span>
														<span className="text-amber-400 font-mono text-[11px] font-semibold">
															{(msg.prompt_metrics?.tokens_per_second || msg.usage?.prompt_tokens_per_second || msg.usage?.prompt_token_s)
																? `${msg.prompt_metrics?.tokens_per_second || msg.usage?.prompt_tokens_per_second || msg.usage?.prompt_token_s} t/s`
																: "-"}
														</span>
													</div>
													<div className="flex items-baseline justify-between mt-0.5">
														<span className="text-xs font-mono font-bold text-slate-100">
															{msg.prompt_metrics?.tokens ?? msg.usage?.prompt_tokens ?? "-"} <span className="text-[10px] font-normal text-slate-400">tokens</span>
														</span>
														<span className="text-[10px] font-mono text-slate-400">
															{msg.prompt_metrics?.duration_seconds ?? msg.usage?.prompt_eval_seconds ?? "-"}s
														</span>
													</div>
												</div>

												{/* Col 2: Generación de Respuesta (Output) */}
												<div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-2 flex flex-col justify-between">
													<div className="flex items-center justify-between text-slate-300 mb-1">
														<span className="flex items-center gap-1 font-semibold text-[11px]">
															<Cpu className="w-3 h-3 text-sky-400" />
															Generación (Output)
														</span>
														<span className="text-emerald-400 font-mono text-[11px] font-semibold">
															{(msg.generation_metrics?.tokens_per_second || msg.usage?.tokens_per_second || msg.usage?.generate_token_s)
																? `${msg.generation_metrics?.tokens_per_second || msg.usage?.tokens_per_second || msg.usage?.generate_token_s} t/s`
																: "-"}
														</span>
													</div>
													<div className="flex items-baseline justify-between mt-0.5">
														<span className="text-xs font-mono font-bold text-slate-100">
															{msg.generation_metrics?.tokens ?? msg.usage?.completion_tokens ?? "-"} <span className="text-[10px] font-normal text-slate-400">tokens</span>
														</span>
														<span className="text-[10px] font-mono text-slate-400">
															{msg.generation_metrics?.duration_seconds ?? msg.usage?.generation_seconds ?? "-"}s
														</span>
													</div>
												</div>

												{/* Col 3: Sesión & KV Cache (RAM) */}
												<div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-2 flex flex-col justify-between">
													<div className="flex items-center justify-between text-slate-300 mb-1">
														<span className="flex items-center gap-1 font-semibold text-[11px]">
															<Layers className="w-3 h-3 text-emerald-400" />
															KV Cache & RAM
														</span>
														<span className="text-sky-300 font-mono text-[11px] font-semibold">
															{msg.kv_metrics?.ram_mb ?? msg.generation_metrics?.kv_cache_ram_mb ?? msg.kv_cache_ram_mb ?? "-"} MB
														</span>
													</div>
													<div className="flex items-baseline justify-between mt-0.5">
														<span className="text-[10px] text-emerald-300 font-mono">
															Restauración: <strong>{msg.kv_metrics?.restore_time_seconds !== undefined ? `${msg.kv_metrics.restore_time_seconds}s` : "0.001s"}</strong>
														</span>
														<span className="text-[10px] font-mono text-slate-400">
															Total: {msg.generation_metrics?.total_tokens ?? msg.usage?.total_tokens ?? "-"} tok
														</span>
													</div>
												</div>
											</div>

											{/* Sub-Agentes (si existieron) */}
											{msg.subagents_metrics && msg.subagents_metrics.length > 0 && (
												<div className="pt-1.5 border-t border-slate-800/60">
													<div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-1 text-[11px]">
														<Bot className="w-3 h-3 text-purple-400" />
														<span>Sub-Agentes Ejecutados ({msg.subagents_metrics.length})</span>
													</div>
													<div className="space-y-1.5 mt-1">
														{msg.subagents_metrics.map((sub, sIdx) => (
															<div key={sIdx} className="bg-purple-950/20 border border-purple-900/40 rounded-lg p-2 text-[10px] space-y-1">
																<div className="flex items-center justify-between flex-wrap gap-1 font-semibold text-purple-300">
																	<span className="flex items-center gap-1">
																		<Bot className="w-2.5 h-2.5 text-purple-400" />
																		<span>{sub.name ? sub.name.toUpperCase() : "AGENTE"}</span>
																	</span>
																	<span className="font-mono text-[9px] text-slate-400">
																		{formatModelName(sub.model)} ({sub.duration_seconds}s)
																	</span>
																</div>
																<div className="grid grid-cols-4 gap-1 font-mono text-[9px]">
																	<div className="bg-slate-900/90 rounded px-1.5 py-0.5 border border-slate-800/60">
																		<span className="text-slate-400">Prompt: </span>
																		<span className="text-slate-200">{sub.prompt_tokens}t ({sub.prompt_tps} t/s)</span>
																	</div>
																	<div className="bg-slate-900/90 rounded px-1.5 py-0.5 border border-slate-800/60">
																		<span className="text-slate-400">Gen: </span>
																		<span className="text-slate-200">{sub.completion_tokens}t ({sub.generation_tps} t/s)</span>
																	</div>
																	<div className="bg-slate-900/90 rounded px-1.5 py-0.5 border border-slate-800/60">
																		<span className="text-slate-400">KV: </span>
																		<span className="text-emerald-300">{sub.kv_restore_time_seconds}s</span>
																	</div>
																	<div className="bg-slate-900/90 rounded px-1.5 py-0.5 border border-slate-800/60">
																		<span className="text-slate-400">RAM: </span>
																		<span className="text-sky-300">{sub.kv_cache_ram_mb}MB</span>
																	</div>
																</div>
															</div>
														))}
													</div>
												</div>
											)}

											{/* Herramientas (Tool-Calling) */}
											{((msg.tools_metrics && msg.tools_metrics.length > 0) || (msg.tools_used && msg.tools_used.length > 0)) ? (
												<div className="pt-1.5 border-t border-slate-800/60">
													<div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-1 text-[11px]">
														<Wrench className="w-3 h-3 text-amber-400" />
														<span>Herramientas Ejecutadas ({((msg.tools_metrics || msg.tools_used).length)})</span>
													</div>
													<div className="space-y-1.5 mt-1">
														{(msg.tools_metrics || msg.tools_used).map((t, tIdx) => (
															<div
																key={tIdx}
																className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 text-[10px] font-mono text-slate-300"
															>
																<div className="flex items-center justify-between font-semibold mb-1 flex-wrap gap-1">
																	<span className="flex items-center gap-1">
																		{t.tool && t.tool.startsWith("delegate_to_") ? (
																			<Bot className="w-2.5 h-2.5 text-purple-400" />
																		) : (
																			<Terminal className="w-2.5 h-2.5 text-amber-400" />
																		)}
																		<span className={t.tool && t.tool.startsWith("delegate_to_") ? "text-purple-300 font-medium" : "text-sky-400"}>
																			{t.tool && t.tool.startsWith("delegate_to_")
																				? `Sub-Agente: ${t.tool.replace("delegate_to_", "").toUpperCase()}`
																				: (t.tool || "herramienta")}
																		</span>
																	</span>
																	<div className="flex items-center gap-1.5">
																		{t.duration_seconds !== undefined && (
																			<span className="inline-flex items-center text-[9px] text-slate-300 bg-slate-800 px-1 py-0.2 rounded border border-slate-700/60">
																				<Clock className="w-2 h-2 mr-0.5 text-slate-400" />
																				{t.duration_seconds}s
																			</span>
																		)}
																		{t.step !== undefined && (
																			<span className="text-[9px] text-slate-500 font-normal">
																				Paso {t.step + 1}
																			</span>
																		)}
																	</div>
																</div>

																{/* Tokens Breakdown */}
																{(t.call_tokens !== undefined || t.total_tokens !== undefined) && (
																	<div className="grid grid-cols-3 gap-1 mb-1.5 bg-slate-950/70 px-2 py-1 rounded border border-slate-800/60 text-[9px]">
																		<div>
																			<span className="text-slate-500 block text-[8px]">Prompt</span>
																			<span className="text-amber-300 font-semibold">{t.call_tokens ?? "-"} tok</span>
																		</div>
																		<div>
																			<span className="text-slate-500 block text-[8px]">Salida</span>
																			<span className="text-sky-300 font-semibold">{t.result_tokens ?? "-"} tok</span>
																		</div>
																		<div>
																			<span className="text-slate-500 block text-[8px]">Total</span>
																			<span className="text-emerald-300 font-semibold">{t.total_tokens ?? "-"} tok</span>
																		</div>
																	</div>
																)}

																{t.args && Object.keys(t.args).length > 0 ? (
																	<div className="bg-slate-950/80 rounded p-1 overflow-x-auto text-slate-400 text-[9px] border border-slate-800/50">
																		{typeof t.args === "string"
																			? t.args
																			: JSON.stringify(t.args, null, 2)}
																	</div>
																) : (
																	<span className="text-slate-500 text-[9px]">Sin argumentos</span>
																)}
															</div>
														))}
													</div>
												</div>
											) : (
												<div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-800/40">
													<span className="flex items-center gap-1">
														<Zap className="w-2.5 h-2.5 text-amber-500/70" />
														Inferencia pura (sin llamadas a herramientas)
													</span>
													<span className="font-mono text-[9px] text-slate-500">
														KV Cache activo
													</span>
												</div>
											)}
										</div>
									)}
								</div>
							)}
						</div>

						{msg.role === "user" && (
							<div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
								<User className="w-4 h-4" />
							</div>
						)}
					</div>
				))}

				{isLoading && (!messages.length || messages[messages.length - 1].role === "user") && (
					<div className="flex items-start gap-3">
						<div className="w-8 h-8 rounded-full bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 mt-0.5">
							<Bot className="w-4 h-4" />
						</div>
						<div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex flex-col gap-1.5 shadow-md">
							<div className="flex items-center gap-2">
								<Loader2 className="w-4 h-4 animate-spin text-sky-400" />
								<span className="text-xs font-medium text-slate-300">Thinking...</span>
							</div>
							<div className="text-[11px] text-sky-400 font-medium tracking-wide flex items-center gap-1.5 pl-6">
								<span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
								<span>{formatThreeWords(modelStatus)}</span>
								<span className="text-[10px] text-slate-400 font-mono font-normal">({stepElapsedSeconds}s)</span>
							</div>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Input Bar */}
			<div className="flex-shrink-0 mt-2 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-800/80">
				<form
					onSubmit={(e) => {
						e.preventDefault()
						if (isRecording) {
							stopVoiceRecording()
						}
						handleSend()
					}}
					className="flex items-center gap-2"
				>
					<button
						type="button"
						onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
						className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all ${
							isRecording
								? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse"
								: "bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300"
						}`}
						title={isRecording ? "Stop recording and transcribe" : "Record voice"}
					>
						{isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
					</button>

					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder={isRecording ? "Escuchando tu voz..." : "Escribe tu mensaje..."}
						disabled={isLoading}
						className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
					/>

					<button
						type="submit"
						disabled={!input.trim() || isLoading}
						className="flex items-center justify-center w-11 h-11 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white transition-all shadow-md shadow-sky-600/30"
						title="Send message"
					>
						<Send className="w-4 h-4" />
					</button>
				</form>
			</div>
		</div>
	)
}
