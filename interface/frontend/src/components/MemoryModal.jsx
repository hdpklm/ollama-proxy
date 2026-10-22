import React, { useState, useEffect } from "react"
import {
	X,
	Cpu,
	Database,
	Layers,
	HardDrive,
	RefreshCw,
	Sparkles,
	Clock,
	CheckCircle2,
	AlertCircle,
	Activity,
	Zap
} from "lucide-react"

export default function MemoryModal({ isOpen, onClose }) {
	const [data, setData] = useState(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const [lastUpdated, setLastUpdated] = useState(null)
	const [activeSection, setActiveSection] = useState("all")

	const fetchMemoryStats = async () => {
		try {
			setLoading(true)
			setError(null)
			const res = await fetch("/api/proxy/memory")
			if (!res.ok) {
				throw new Error(`Error HTTP: ${res.status}`)
			}
			const json = await res.json()
			if (json.status === "error") {
				throw new Error(json.message || "Error al consultar la memoria del proxy")
			}
			setData(json)
			setLastUpdated(new Date().toLocaleTimeString())
		} catch (err) {
			console.error("Failed fetching memory stats:", err)
			setError(err.message || "No se pudo conectar con el proxy LLM")
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		if (isOpen) {
			fetchMemoryStats()
			const interval = setInterval(fetchMemoryStats, 8000)
			return () => clearInterval(interval)
		}
	}, [isOpen])

	if (!isOpen) return null

	const formatMb = (mb) => {
		if (mb === undefined || mb === null) return "0 MB"
		if (mb >= 1024) {
			return `${(mb / 1024).toFixed(2)} GB`
		}
		return `${Number(mb).toFixed(1)} MB`
	}

	const rss = data?.process?.rss_mb || 0
	const vms = data?.process?.vms_mb || 0
	const modelMb = data?.model?.file_size_mb || 0
	const promptCacheMb = data?.prompt_cache?.prompt_caches_total_mb || 0
	const tempSnapshotsMb = data?.prompt_cache?.temporal_snapshots_total_mb || 0
	const totalKvAllocated = data?.active_contexts?.total_allocated_kv_mb || 0

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in overflow-hidden">
			<div className="relative w-full max-w-2xl max-h-[90dvh] flex flex-col bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
				{/* Modal Header */}
				<div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-950/40">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
							<Activity className="w-5 h-5" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h3 className="text-base font-semibold text-white tracking-tight">Memoria RAM del Proxy</h3>
								<span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
									<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
									En vivo
								</span>
							</div>
							<p className="text-xs text-slate-400">
								{lastUpdated ? `Actualizado a las ${lastUpdated}` : "Consultando telemetría del motor Llama..."}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-1.5">
						<button
							onClick={fetchMemoryStats}
							disabled={loading}
							className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800/60 transition-all active:scale-95 disabled:opacity-50"
							title="Refrescar métricas ahora"
						>
							<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
						</button>
						<button
							onClick={onClose}
							className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
						>
							<X className="w-5 h-5" />
						</button>
					</div>
				</div>

				{/* Error Notice */}
				{error && (
					<div className="mx-5 mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
						<AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
						<span>{error}</span>
					</div>
				)}

				{/* Modal Content */}
				<div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5 custom-scrollbar">
					{/* Top Summary Metric Cards */}
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
						{/* Card 1: Total Process RSS */}
						<div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 relative overflow-hidden">
							<div className="flex items-center justify-between text-slate-400 text-xs mb-1">
								<span>RAM Proceso (RSS)</span>
								<Cpu className="w-3.5 h-3.5 text-emerald-400" />
							</div>
							<div className="text-lg font-bold text-emerald-400">{formatMb(rss)}</div>
							<div className="text-[10px] text-slate-500 mt-0.5">Virtual: {formatMb(vms)}</div>
						</div>

						{/* Card 2: Original Model File */}
						<div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
							<div className="flex items-center justify-between text-slate-400 text-xs mb-1">
								<span>Modelo Base</span>
								<HardDrive className="w-3.5 h-3.5 text-sky-400" />
							</div>
							<div className="text-lg font-bold text-sky-400">{formatMb(modelMb)}</div>
							<div className="text-[10px] text-slate-500 mt-0.5 truncate" title={data?.model?.filename || "GGUF"}>
								{data?.model?.filename || "GGUF"}
							</div>
						</div>

						{/* Card 3: Prompt Caches */}
						<div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
							<div className="flex items-center justify-between text-slate-400 text-xs mb-1">
								<span>Prompt Caches</span>
								<Database className="w-3.5 h-3.5 text-purple-400" />
							</div>
							<div className="text-lg font-bold text-purple-400">{formatMb(promptCacheMb)}</div>
							<div className="text-[10px] text-slate-500 mt-0.5">
								{data?.prompt_cache?.prompt_caches_count || 0} agentes en RAM
							</div>
						</div>

						{/* Card 4: Temporal Caches / Snapshots */}
						<div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
							<div className="flex items-center justify-between text-slate-400 text-xs mb-1">
								<span>Snapshots Temp.</span>
								<Layers className="w-3.5 h-3.5 text-amber-400" />
							</div>
							<div className="text-lg font-bold text-amber-400">{formatMb(tempSnapshotsMb)}</div>
							<div className="text-[10px] text-slate-500 mt-0.5">
								{data?.prompt_cache?.temporal_snapshots_count || 0} activos
							</div>
						</div>
					</div>

					{/* 1. MODELO ORIGINAL (BASE GGUF) */}
					<div className="rounded-xl bg-slate-950/40 border border-slate-800/80 p-4">
						<div className="flex items-center justify-between pb-3 border-b border-slate-800/60 mb-3">
							<div className="flex items-center gap-2">
								<HardDrive className="w-4 h-4 text-sky-400" />
								<h4 className="text-sm font-semibold text-slate-200">1. Modelo Original (GGUF Weights)</h4>
							</div>
							<span className="text-xs px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-mono border border-sky-500/20">
								{formatMb(modelMb)}
							</span>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
							<div className="flex flex-col gap-1 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/40">
								<span className="text-slate-400">Archivo GGUF:</span>
								<span className="font-mono text-slate-200 truncate" title={data?.model?.path || "Ruta del modelo"}>
									{data?.model?.filename || "No detectado"}
								</span>
							</div>

							<div className="flex flex-col gap-1 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/40">
								<span className="text-slate-400">Configuración del Motor:</span>
								<span className="text-slate-200">
									Flash Attention: <span className={data?.model?.flash_attn ? "text-emerald-400 font-medium" : "text-slate-400"}>{data?.model?.flash_attn ? "Sí" : "No"}</span> | Hilos: {data?.model?.threads || 4}
								</span>
							</div>
						</div>
					</div>

					{/* 2. CONTEXTOS KV DEL ENGINE (DUAL CONTEXT) */}
					<div className="rounded-xl bg-slate-950/40 border border-slate-800/80 p-4">
						<div className="flex items-center justify-between pb-3 border-b border-slate-800/60 mb-3">
							<div className="flex items-center gap-2">
								<Cpu className="w-4 h-4 text-emerald-400" />
								<h4 className="text-sm font-semibold text-slate-200">2. Contextos KV Activos (Planificador Preemptivo)</h4>
							</div>
							<span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
								Max Asignado: {formatMb(totalKvAllocated)}
							</span>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
							{/* High Priority */}
							<div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/50 flex flex-col gap-1.5">
								<div className="flex items-center justify-between font-medium">
									<span className="text-rose-400 flex items-center gap-1.5">
										<Zap className="w-3.5 h-3.5" /> Alta Prioridad
									</span>
									<span className="text-slate-300 font-mono">
										Max {data?.active_contexts?.high_priority?.n_ctx_max || 0} tokens
									</span>
								</div>
								<div className="flex items-center justify-between text-slate-400 mt-1">
									<span>KV RAM máxima:</span>
									<span className="text-slate-200 font-mono">
										{formatMb(data?.active_contexts?.high_priority?.max_kv_ram_mb)}
									</span>
								</div>
								<div className="flex items-center justify-between text-slate-400">
									<span>Tokens activos ahora:</span>
									<span className="text-emerald-400 font-mono font-medium">
										{data?.active_contexts?.high_priority?.active_tokens || 0} tks ({formatMb(data?.active_contexts?.high_priority?.active_kv_ram_mb)})
									</span>
								</div>
							</div>

							{/* Low Priority */}
							<div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/50 flex flex-col gap-1.5">
								<div className="flex items-center justify-between font-medium">
									<span className="text-sky-400 flex items-center gap-1.5">
										<Clock className="w-3.5 h-3.5" /> Baja Prioridad (Normal)
									</span>
									<span className="text-slate-300 font-mono">
										Max {data?.active_contexts?.low_priority?.n_ctx_max || 0} tokens
									</span>
								</div>
								<div className="flex items-center justify-between text-slate-400 mt-1">
									<span>KV RAM máxima:</span>
									<span className="text-slate-200 font-mono">
										{formatMb(data?.active_contexts?.low_priority?.max_kv_ram_mb)}
									</span>
								</div>
								<div className="flex items-center justify-between text-slate-400">
									<span>Tokens activos ahora:</span>
									<span className="text-sky-400 font-mono font-medium">
										{data?.active_contexts?.low_priority?.active_tokens || 0} tks ({formatMb(data?.active_contexts?.low_priority?.active_kv_ram_mb)})
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* 3. CACHES DE PROMPTS EN RAM (PRE-WARMED AGENTS) */}
					<div className="rounded-xl bg-slate-950/40 border border-slate-800/80 p-4">
						<div className="flex items-center justify-between pb-3 border-b border-slate-800/60 mb-3">
							<div className="flex items-center gap-2">
								<Database className="w-4 h-4 text-purple-400" />
								<div>
									<h4 className="text-sm font-semibold text-slate-200">3. Cachés de Prompts en RAM (System Prompts)</h4>
									<p className="text-[11px] text-slate-400">Estados binarios precargados en RAM para respuesta instantánea (0ms prompt-eval)</p>
								</div>
							</div>
							<span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono border border-purple-500/20">
								{formatMb(promptCacheMb)}
							</span>
						</div>

						{data?.prompt_cache?.prompt_caches?.length > 0 ? (
							<div className="space-y-2">
								{data.prompt_cache.prompt_caches.map((cache, idx) => (
									<div
										key={idx}
										className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/40 hover:border-slate-700/60 transition-colors text-xs"
									>
										<div className="flex items-center gap-2.5">
											<span className="p-1 rounded bg-purple-500/10 text-purple-400">
												<Sparkles className="w-3.5 h-3.5" />
											</span>
											<div>
												<span className="font-semibold text-slate-200 capitalize">
													{cache.agent_name.replace(/_/g, " ")}
												</span>
												<span className="ml-2 font-mono text-[10px] text-slate-500">
													#{cache.hash}
												</span>
											</div>
										</div>

										<div className="flex items-center gap-4 text-right">
											<div className="text-slate-400">
												<span className="font-mono text-slate-200">{cache.tokens}</span> tokens
											</div>
											<div className="font-mono text-purple-400 font-semibold w-16 text-right">
												{formatMb(cache.total_mb)}
											</div>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="p-4 text-center text-xs text-slate-500 bg-slate-900/30 rounded-lg">
								No hay cachés de prompt cargados en memoria RAM.
							</div>
						)}
					</div>

					{/* 4. CACHES TEMPORALES (SNAPSHOTS EN RAM DE SUB-AGENTES) */}
					<div className="rounded-xl bg-slate-950/40 border border-slate-800/80 p-4">
						<div className="flex items-center justify-between pb-3 border-b border-slate-800/60 mb-3">
							<div className="flex items-center gap-2">
								<Layers className="w-4 h-4 text-amber-400" />
								<div>
									<h4 className="text-sm font-semibold text-slate-200">4. Cachés Temporales (Snapshots de Contexto)</h4>
									<p className="text-[11px] text-slate-400">Memoria congelada en RAM cuando el agente principal delega en sub-agentes</p>
								</div>
							</div>
							<span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono border border-amber-500/20">
								{formatMb(tempSnapshotsMb)}
							</span>
						</div>

						{data?.prompt_cache?.temporal_snapshots?.length > 0 ? (
							<div className="space-y-2">
								{data.prompt_cache.temporal_snapshots.map((snap, idx) => (
									<div
										key={idx}
										className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs"
									>
										<div className="flex items-center gap-2.5">
											<span className="p-1 rounded bg-amber-500/20 text-amber-300">
												<Clock className="w-3.5 h-3.5" />
											</span>
											<div>
												<span className="font-mono text-slate-200 font-medium">{snap.snapshot_id}</span>
												<span className="ml-2 text-[10px] text-amber-400/80">Contexto preservado en RAM</span>
											</div>
										</div>

										<div className="font-mono text-amber-400 font-semibold">
											{formatMb(snap.total_mb)}
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="p-3.5 text-center text-xs text-slate-400 bg-slate-900/40 rounded-lg border border-dashed border-slate-800 flex items-center justify-center gap-2">
								<CheckCircle2 className="w-4 h-4 text-emerald-400/80" />
								<span>Sin snapshots activos en este momento (se crean dinámicamente al delegar y se liberan al retornar).</span>
							</div>
						)}
					</div>
				</div>

				{/* Footer */}
				<div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-t border-slate-800/80 bg-slate-950/60 text-xs text-slate-400">
					<span>Auto-refresco cada 8 segundos mientras la ventana esté abierta</span>
					<button
						onClick={onClose}
						className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
					>
						Cerrar
					</button>
				</div>
			</div>
		</div>
	)
}
