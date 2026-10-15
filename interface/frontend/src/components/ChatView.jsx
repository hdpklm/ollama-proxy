import React, { useState, useRef, useEffect } from "react"
import { Send, Mic, Square, Play, Pause, Loader2, Bot, User, Volume2 } from "lucide-react"

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

	const messagesEndRef = useRef(null)
	const speechRecRef = useRef(null)
	const chatWsRef = useRef(null)
	const chatMicStreamRef = useRef(null)
	const chatMicContextRef = useRef(null)
	const chatProcessorRef = useRef(null)
	const currentAudioRef = useRef(null)
	const audioCacheRef = useRef({})

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [messages, isLoading])

	const handleSend = async (textToSend) => {
		const text = (textToSend || input).trim()
		if (!text || isLoading) return

		const newHistory = [...messages, { role: "user", content: text }]
		setMessages(newHistory)
		setInput("")
		setIsLoading(true)

		try {
			const res = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ messages: newHistory })
			})
			if (!res.ok) throw new Error("Failed to contact LLM")
			const data = await res.json()
			const assistantContent = data.message?.content || data.response || "No response"

			setMessages([...newHistory, { role: "assistant", content: assistantContent }])
		} catch (err) {
			console.error("Chat error:", err)
			setMessages([
				...newHistory,
				{ role: "assistant", content: "Error al comunicarse con el modelo." }
			])
		} finally {
			setIsLoading(false)
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
						setInput(fullTranscript.trim())
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
					const data = json.loads ? JSON.parse(event.data) : JSON.parse(event.data)
					if (data.type === "transcript" && data.text) {
						setInput(data.text)
					}
				} catch (e) {}
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
		}
	}, [])

	return (
		<div className="flex flex-col h-full max-w-3xl mx-auto px-4 py-4">
			{/* Messages Container */}
			<div className="flex-1 overflow-y-auto space-y-4 pr-1">
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
							<p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

							{msg.role === "assistant" && (
								<div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-2">
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

				{isLoading && (
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
			<div className="mt-4 pt-3 border-t border-slate-800/80">
				<form
					onSubmit={(e) => {
						e.preventDefault()
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
