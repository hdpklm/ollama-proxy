import React from "react"
import { X, Cpu, Globe, Sliders } from "lucide-react"

export default function SettingsModal({ isOpen, onClose, settings, onUpdateSettings }) {
	if (!isOpen) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
			<div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100">
				{/* Header */}
				<div className="flex items-center justify-between pb-4 border-b border-slate-800">
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
				<div className="space-y-5 my-5">
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
				</div>

				{/* Footer */}
				<div className="pt-3 border-t border-slate-800 flex justify-end">
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
