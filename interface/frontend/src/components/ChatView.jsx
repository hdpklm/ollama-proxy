import React, { useState, useRef, useEffect } from "react"
import { Send, Mic, Square, Play, Pause, Loader2, Bot, User, Volume2, VolumeX, Activity, Wrench, ChevronDown, ChevronUp, Cpu, Terminal } from "lucide-react"

export default function ChatView({ settings = { useBrowserTTS: false, useBrowserSTT: false } }) {
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
				body: JSON.stringify({ messages: history })
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

		try {
			const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
			const wsUrl = `${protocol}//${window.location.host}/ws/chat`
			const ws = new WebSocket(wsUrl)
			streamWsRef.current = ws

			ws.onopen = () => {
				ws.send(JSON.stringify({
					messages: newHistory,
					tts_mode: settings.useBrowserTTS ? "browser" : "rpi5"
				}))
			}

			let accumulatedText = ""
			let currentTools = []
			let currentUsage = null
			let currentMeta = {}

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data)
					if (data.type === "token" && data.token) {
						accumulatedText += data.token
						setMessages((prev) => {
							const last = prev[prev.length - 1]
							const newMsg = {
								role: "assistant",
								content: accumulatedText,
								tools_used: currentTools,
								usage: currentUsage,
								...currentMeta
							}
							if (last && last.role === "assistant") {
								return [...prev.slice(0, -1), newMsg]
							} else {
								return [...prev, newMsg]
							}
						})
					} else if (data.type === "thinking_token") {
						console.log("[WS Thinking Token]", data.token)
					} else if (data.type === "tool_calling" || data.type === "tool_calling_token") {
						console.log("[WS Tool Calling]", data)
						if (data.tool) {
							const exists = currentTools.some(
								(t) => t.tool === data.tool && JSON.stringify(t.args) === JSON.stringify(data.args)
							)
							if (!exists) {
								currentTools = [...currentTools, { tool: data.tool, args: data.args, step: data.step }]
								setMessages((prev) => {
									const last = prev[prev.length - 1]
									if (last && last.role === "assistant") {
										return [...prev.slice(0, -1), { ...last, tools_used: currentTools }]
									}
									return prev
								})
							}
						}
					} else if (data.type === "tool_executing") {
						console.log("[WS Tool Executing]", data)
					} else if (data.type === "tool_result") {
						console.log("[WS Tool Result]", data)
					} else if (data.type === "usage") {
						currentUsage = data.usage || currentUsage
						currentMeta = {
							priority: data.priority ?? currentMeta.priority,
							times_paused: data.times_paused ?? currentMeta.times_paused,
							kv_cache_ram_mb: data.kv_cache_ram_mb ?? currentMeta.kv_cache_ram_mb
						}
						setMessages((prev) => {
							const last = prev[prev.length - 1]
							if (last && last.role === "assistant") {
								return [
									...prev.slice(0, -1),
									{
										...last,
										usage: currentUsage,
										...currentMeta
									}
								]
							}
							return prev
						})
					} else if (data.type === "debug") {
						console.log("[WS Debug]", data)
					} else if (data.type === "audio_chunk" && data.audio_base64) {
						enqueueAudioChunk(data.audio_base64)
					} else if (data.type === "tts_sentence" && data.text) {
						enqueueBrowserTts(data.text)
					} else if (data.type === "done") {
						const finalTools = (data.tools_used && data.tools_used.length > 0) ? data.tools_used : currentTools
						const finalUsage = data.usage || currentUsage
						const finalPriority = data.priority ?? currentMeta.priority
						const finalTimesPaused = data.times_paused ?? currentMeta.times_paused
						const finalKvCache = data.kv_cache_ram_mb ?? currentMeta.kv_cache_ram_mb

						setMessages((prev) => {
							const last = prev[prev.length - 1]
							if (last && last.role === "assistant") {
								return [
									...prev.slice(0, -1),
									{
										...last,
										content: accumulatedText || last.content,
										tools_used: finalTools,
										usage: finalUsage,
										priority: finalPriority,
										times_paused: finalTimesPaused,
										kv_cache_ram_mb: finalKvCache
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
		}
	}, [])

	return (
		<div className="flex flex-col h-full max-w-3xl mx-auto px-3 sm:px-4 py-2.5 sm:py-4 min-h-0 overflow-hidden">
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
							<p className="text-sm leading-relaxed whitespace-pre-wrap">
								{msg.content}
								{isLoading && index === messages.length - 1 && msg.role === "assistant" && (
									<span className="inline-block w-1.5 h-4 ml-1 bg-sky-400 animate-pulse align-middle" />
								)}
							</p>

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
										<div className="w-full bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 text-xs text-slate-300 space-y-3 shadow-inner">
											<div>
												<div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-2">
													<Cpu className="w-3.5 h-3.5 text-sky-400" />
													<span>Velocidad y Tokens de Generación</span>
												</div>
												{msg.usage ? (
													<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
														<div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2 flex flex-col">
															<span className="text-[10px] text-slate-400 uppercase tracking-wide">Prompt</span>
															<span className="text-sm font-semibold text-slate-100">
																{msg.usage.prompt_tokens ?? "-"} <span className="text-[10px] font-normal text-slate-400">tokens</span>
															</span>
															<span className="text-[11px] text-sky-400 font-mono mt-0.5">
																{(msg.usage.prompt_tokens_per_second || msg.usage.prompt_token_s)
																	? `${msg.usage.prompt_tokens_per_second || msg.usage.prompt_token_s} t/s`
																	: "-"}
															</span>
														</div>

														<div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2 flex flex-col">
															<span className="text-[10px] text-slate-400 uppercase tracking-wide">Generación</span>
															<span className="text-sm font-semibold text-slate-100">
																{msg.usage.completion_tokens ?? "-"} <span className="text-[10px] font-normal text-slate-400">tokens</span>
															</span>
															<span className="text-[11px] text-emerald-400 font-mono mt-0.5">
																{(msg.usage.tokens_per_second || msg.usage.generate_token_s)
																	? `${msg.usage.tokens_per_second || msg.usage.generate_token_s} t/s`
																	: "-"}
															</span>
														</div>

														<div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2 flex flex-col col-span-2 sm:col-span-1">
															<span className="text-[10px] text-slate-400 uppercase tracking-wide">Total</span>
															<span className="text-sm font-semibold text-slate-100">
																{msg.usage.total_tokens ?? ((msg.usage.prompt_tokens || 0) + (msg.usage.completion_tokens || 0))} <span className="text-[10px] font-normal text-slate-400">tokens</span>
															</span>
															{msg.times_paused !== undefined && msg.times_paused > 0 ? (
																<span className="text-[10px] text-amber-400 mt-0.5">
																	{msg.times_paused} {msg.times_paused === 1 ? "pausa" : "pausas"}
																</span>
															) : (
																<span className="text-[10px] text-slate-400 mt-0.5">
																	Prioridad: {msg.priority ? "Alta" : "Baja"}
																</span>
															)}
														</div>
													</div>
												) : (
													<div className="text-[11px] text-slate-500 italic bg-slate-900/40 border border-slate-800/40 rounded-lg p-2">
														Sin telemetría de rendimiento registrada para este mensaje.
													</div>
												)}
											</div>

											<div className="pt-2 border-t border-slate-800/60">
												<div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-1.5">
													<Wrench className="w-3.5 h-3.5 text-amber-400" />
													<span>Herramientas Utilizadas</span>
												</div>
												{msg.tools_used && msg.tools_used.length > 0 ? (
													<div className="space-y-1.5 mt-1">
														{msg.tools_used.map((t, tIdx) => (
															<div
																key={tIdx}
																className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 text-[11px] font-mono text-slate-300"
															>
																<div className="flex items-center justify-between font-semibold mb-1">
																	<span className="flex items-center gap-1">
																		{t.tool && t.tool.startsWith("delegate_to_") ? (
																			<Bot className="w-3 h-3 text-purple-400" />
																		) : (
																			<Terminal className="w-3 h-3 text-amber-400" />
																		)}
																		<span className={t.tool && t.tool.startsWith("delegate_to_") ? "text-purple-300 font-medium" : "text-sky-400"}>
																			{t.tool && t.tool.startsWith("delegate_to_")
																				? `Sub-Agente: ${t.tool.replace("delegate_to_", "").toUpperCase()}`
																				: (t.tool || "herramienta")}
																		</span>
																	</span>
																	{t.step !== undefined && (
																		<span className="text-[10px] text-slate-500 font-normal">
																			Paso {t.step + 1}
																		</span>
																	)}
																</div>
																{t.args && Object.keys(t.args).length > 0 ? (
																	<div className="bg-slate-950/80 rounded p-1.5 overflow-x-auto text-slate-400 text-[10px] border border-slate-800/50">
																		{typeof t.args === "string"
																			? t.args
																			: JSON.stringify(t.args, null, 2)}
																	</div>
																) : (
																	<span className="text-slate-500 text-[10px]">Sin argumentos</span>
																)}
															</div>
														))}
													</div>
												) : (
													<div className="text-[11px] text-slate-400 italic bg-slate-900/40 border border-slate-800/40 rounded-lg p-2">
														No se utilizaron herramientas externas en este turno.
													</div>
												)}
											</div>
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
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 rounded-full bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
							<Bot className="w-4 h-4" />
						</div>
						<div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2">
							<Loader2 className="w-4 h-4 animate-spin text-sky-400" />
							<span className="text-xs text-slate-400">Thinking...</span>
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
