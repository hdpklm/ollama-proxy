import React from "react"
import { X, Cpu, Globe, Sliders, Waves } from "lucide-react"

export default function SettingsModal({ isOpen, onClose, settings, onUpdateSettings }) {
	if (!isOpen) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-hidden">
			<div className="relative w-full max-w-md max-h-[88dvh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-6 text-slate-100">
				{/* Header */}
				<div className="flex-shrink-0 flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800">
					<div className="flex items-center gap-2.5">
						<div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
							<Sliders className="w-5 h-5" />
						</div>
						<div>
							<h3 className="text-base font-semibold">Configuración de Voz</h3>
							<p className="text-xs text-slate-400">Elige dónde procesar el audio</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Options List */}
				<div className="flex-1 min-h-0 overflow-y-auto space-y-4 my-3 sm:my-4 pr-1 sm:pr-1.5">
					{/* Option 1: TTS */}
					<div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
						<label className="flex items-start gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={settings.useBrowserTTS}
								onChange={(e) => onUpdateSettings({ useBrowserTTS: e.target.checked })}
								className="mt-1 w-4 h-4 rounded text-sky-600 bg-slate-900 border-slate-700 focus:ring-sky-500/40"
							/>
							<div className="flex-1">
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium text-slate-200">
										TTS del Navegador (SpeechSynthesis)
									</span>
									{settings.useBrowserTTS ? (
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
											Navegador
										</span>
									) : (
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
											RPi5 (Piper)
										</span>
									)}
								</div>
								<p className="text-xs text-slate-400 mt-1 leading-relaxed">
									{settings.useBrowserTTS
										? "El navegador sintetiza la voz con el motor del dispositivo, reduciendo el consumo de CPU y RAM de la RPi5."
										: "Piper TTS se ejecuta en el contenedor de la RPi5 para una voz neural idéntica en cualquier cliente."}
								</p>
							</div>
						</label>
					</div>

					{/* Option 2: STT */}
					<div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
						<label className="flex items-start gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={settings.useBrowserSTT}
								onChange={(e) => onUpdateSettings({ useBrowserSTT: e.target.checked })}
								className="mt-1 w-4 h-4 rounded text-sky-600 bg-slate-900 border-slate-700 focus:ring-sky-500/40"
							/>
							<div className="flex-1">
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium text-slate-200">
										STT del Navegador (SpeechRecognition)
									</span>
									{settings.useBrowserSTT ? (
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
											Navegador
										</span>
									) : (
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
											RPi5 (Vosk)
										</span>
									)}
								</div>
								<p className="text-xs text-slate-400 mt-1 leading-relaxed">
									{settings.useBrowserSTT
										? "El reconocimiento de voz se procesa directamente en tu navegador/dispositivo, aliviando la carga del servidor."
										: "Vosk STT procesa el audio en el contenedor de la RPi5 de forma 100% privada y offline."}
								</p>
							</div>
						</label>
					</div>

					{/* Option 3: Barge-in (Interrupción por voz) */}
					<div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
						<label className="flex items-start gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={settings.allowBargeIn !== false}
								onChange={(e) => onUpdateSettings({ allowBargeIn: e.target.checked })}
								className="mt-1 w-4 h-4 rounded text-sky-600 bg-slate-900 border-slate-700 focus:ring-sky-500/40"
							/>
							<div className="flex-1">
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium text-slate-200">
										Interrumpir al hablar (Barge-in)
									</span>
									{settings.allowBargeIn !== false ? (
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
											Activado
										</span>
									) : (
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">
											Desactivado
										</span>
									)}
								</div>
								<p className="text-xs text-slate-400 mt-1 leading-relaxed">
									{settings.allowBargeIn !== false
										? "Si empiezas a hablar mientras el asistente responde, parará de hablar de inmediato para escucharte y responder a tu nueva pregunta."
										: "El asistente terminará de hablar completamente antes de volver a escuchar. Ideal si hay ruido ambiente o prefieres escuchar sin interrupciones."}
								</p>
							</div>
						</label>
					</div>

					{/* Option 4: AEC Mode (Cancelación de Eco) */}
					<div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
						<div className="flex items-start gap-3">
							<div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 mt-0.5">
								<Waves className="w-4 h-4" />
							</div>
							<div className="flex-1">
								<div className="flex items-center justify-between mb-1.5">
									<span className="text-sm font-medium text-slate-200">
										Cancelación de Eco y Procesamiento
									</span>
									<span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase font-mono">
										{settings.aecMode || "native"}
									</span>
								</div>
								<select
									value={settings.aecMode || "native"}
									onChange={(e) => onUpdateSettings({ aecMode: e.target.value })}
									className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
								>
									<option value="native">Modo 1: Nativo (HTML5 Audio + AEC Hardware)</option>
									<option value="vad">Modo 2: Híbrido (HTML5 Audio + Silero VAD)</option>
									<option value="wasm">Modo 3: Avanzado (WASM AEC3 + Sincro/Calibración)</option>
								</select>
								<p className="text-xs text-slate-400 mt-2 leading-relaxed">
									{settings.aecMode === "wasm"
										? "AEC3 de WebRTC en WebAssembly. Emite un tono sutil al iniciar para medir la latencia física de la sala y sustraer el eco por software."
										: settings.aecMode === "vad"
										? "Silero VAD en el navegador. Analiza la voz humana en tiempo real y corta la transmisión hacia Vosk si solo suena el altavoz."
										: "Reproduce vía HTMLAudioElement directo sin compresor de micro. Usa la cancelación nativa por hardware del navegador."}
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="flex-shrink-0 pt-3 border-t border-slate-800 flex justify-end">
					<button
						onClick={onClose}
						className="px-4 py-2 text-xs font-medium rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition-colors"
					>
						Guardar y Cerrar
					</button>
				</div>
			</div>
		</div>
	)
}
