import React, { useState, useEffect } from "react"
import { 
	History, 
	X, 
	ChevronDown, 
	ChevronRight, 
	Search, 
	MessageSquare, 
	Wrench, 
	Bot, 
	Layers, 
	Database, 
	Clock, 
	User, 
	Cpu,
	FileText,
	CheckCircle2,
	GitBranch
} from "lucide-react"

function TreeNodeItem({ node, path = "root", level = 0, expandedNodes, onToggle }) {
	const childrenKeys = node && node.children ? Object.keys(node.children) : []
	const hasChildren = childrenKeys.length > 0
	const isExpanded = !!expandedNodes[path]

	return (
		<div className="w-full min-w-0 max-w-full my-1">
			<div
				onClick={() => hasChildren && onToggle(path)}
				className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-xs select-none max-w-full min-w-0 ${
					hasChildren ? "cursor-pointer hover:bg-slate-800/60" : "cursor-default"
				} ${
					level === 0
						? "bg-sky-950/40 border-sky-800/50 text-sky-200"
						: level === 1
						? "bg-indigo-950/30 border-indigo-800/40 text-indigo-200"
						: "bg-slate-900/60 border-slate-800/70 text-slate-300"
				}`}
				style={{ marginLeft: `${Math.min(level * 16, 64)}px` }}
			>
				{hasChildren ? (
					<button
						type="button"
						className="p-1 rounded-md bg-slate-800/80 text-sky-400 hover:bg-slate-700/80 flex-shrink-0"
						title={isExpanded ? "Colapsar nodo" : "Expandir nodo"}
					>
						{isExpanded ? (
							<ChevronDown className="w-3.5 h-3.5" />
						) : (
							<ChevronRight className="w-3.5 h-3.5" />
						)}
					</button>
				) : (
					<div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
						<span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
					</div>
				)}

				<div className="flex items-center gap-2 flex-shrink-0">
					<span className="font-semibold text-white tracking-wide">{node.name || "node"}</span>
					<span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700/60">
						Nivel {level}
					</span>
					{hasChildren && (
						<span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-950/60 border border-sky-800/50 text-sky-300">
							{childrenKeys.length} {childrenKeys.length === 1 ? "hijo" : "hijos"}
						</span>
					)}
				</div>

				{/* Parameters with Horizontal Scroll to prevent screen enlargement */}
				<div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-thin scrollbar-thumb-slate-700 py-0.5">
					<div className="inline-flex items-center gap-2 text-[11px] text-slate-400 font-mono">
						{node.updated_at && (
							<span className="inline-flex items-center gap-1 bg-slate-950/70 px-2 py-0.5 rounded border border-slate-800/80">
								<Clock className="w-3 h-3 text-slate-500" />
								{new Date(node.updated_at * 1000).toLocaleString("es-ES", {
									hour: "2-digit",
									minute: "2-digit",
									second: "2-digit",
									day: "2-digit",
									month: "short"
								})}
							</span>
						)}

						{node.data && (
							<span className="inline-flex items-center gap-1 bg-slate-950/90 text-emerald-300 px-2 py-0.5 rounded border border-emerald-900/50">
								<span className="text-emerald-500 font-bold">data:</span>
								<span>{node.data}</span>
							</span>
						)}

						{Object.entries(node)
							.filter(([k]) => !["name", "children", "updated_at", "data"].includes(k))
							.map(([k, v]) => (
								<span key={k} className="inline-flex items-center gap-1 bg-slate-950/70 px-2 py-0.5 rounded border border-slate-800">
									<span className="text-slate-500 font-semibold">{k}:</span>
									<span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
								</span>
							))}
					</div>
				</div>
			</div>

			{/* Children Nodes (Collapsed by default) */}
			{hasChildren && isExpanded && (
				<div className="border-l border-slate-800/70 ml-3 pl-1 space-y-1 mt-1 animate-in fade-in duration-150">
					{childrenKeys.map((k) => (
						<TreeNodeItem
							key={`${path}/${k}`}
							node={node.children[k]}
							path={`${path}/${k}`}
							level={level + 1}
							expandedNodes={expandedNodes}
							onToggle={onToggle}
						/>
					))}
				</div>
			)}
		</div>
	)
}

export default function HistoryModal({ isOpen, onClose }) {
	const [conversations, setConversations] = useState([])
	const [selectedSession, setSelectedSession] = useState(null)
	const [files, setFiles] = useState([])
	const [expandedTurns, setExpandedTurns] = useState({})
	const [fileContents, setFileContents] = useState({})
	const [searchQuery, setSearchQuery] = useState("")
	const [loadingConvs, setLoadingConvs] = useState(false)
	const [loadingFiles, setLoadingFiles] = useState(false)
	const [activeTab, setActiveTab] = useState("turns")
	const [treeData, setTreeData] = useState(null)
	const [expandedNodes, setExpandedNodes] = useState({})

	useEffect(() => {
		if (isOpen) {
			loadConversations()
		}
	}, [isOpen])

	const loadConversations = async () => {
		setLoadingConvs(true)
		try {
			const res = await fetch("/api/logs/conversations")
			if (res.ok) {
				const data = await res.json()
				const list = data.conversations || []
				setConversations(list)
				if (list.length > 0 && !selectedSession) {
					selectSession(list[0].session_dir)
				}
			}
		} catch (err) {
			console.error("Error loading conversations:", err)
		} finally {
			setLoadingConvs(false)
		}
	}

	const selectSession = async (sessionDir) => {
		setSelectedSession(sessionDir)
		setLoadingFiles(true)
		setExpandedTurns({})
		setExpandedNodes({})
		try {
			const [filesRes, treeRes] = await Promise.all([
				fetch(`/api/logs/conversations/${encodeURIComponent(sessionDir)}`),
				fetch(`/api/logs/conversations/${encodeURIComponent(sessionDir)}/tree`)
			])

			if (filesRes.ok) {
				const data = await filesRes.json()
				const fileList = data.files || []
				setFiles(fileList)

				const contents = {}
				await Promise.all(
					fileList.map(async (f) => {
						try {
							const fRes = await fetch(
								`/api/logs/conversations/${encodeURIComponent(sessionDir)}/${encodeURIComponent(f.filename)}`
							)
							if (fRes.ok) {
								const fData = await fRes.json()
								contents[f.filename] = fData.content || ""
							}
						} catch (e) {}
					})
				)
				setFileContents(contents)
			}

			if (treeRes.ok) {
				const tData = await treeRes.json()
				setTreeData(tData.tree || null)
			} else {
				setTreeData(null)
			}
		} catch (err) {
			console.error("Error loading conversation files or tree:", err)
		} finally {
			setLoadingFiles(false)
		}
	}

	const toggleTurn = (turnIndex) => {
		setExpandedTurns((prev) => ({
			...prev,
			[turnIndex]: !prev[turnIndex]
		}))
	}

	const toggleNode = (path) => {
		setExpandedNodes((prev) => ({
			...prev,
			[path]: !prev[path]
		}))
	}

	const collapseAllNodes = () => {
		setExpandedNodes({})
	}

	const expandAllNodes = () => {
		if (!treeData) return
		const allPaths = {}
		const traverse = (node, path) => {
			if (!node) return
			allPaths[path] = true
			if (node.children) {
				Object.keys(node.children).forEach((k) => traverse(node.children[k], `${path}/${k}`))
			}
		}
		traverse(treeData, "root")
		setExpandedNodes(allPaths)
	}

	if (!isOpen) return null

	const filteredConvs = conversations.filter((c) =>
		c.session_dir.toLowerCase().includes(searchQuery.toLowerCase())
	)

	// Group files into logical turns
	// 001-user.md -> user turn 1
	// 002-tool-*.md, 003-agent-*.md, 004-plan-step-*.md -> steps leading to or within turn
	const userTurnFiles = files.filter((f) => f.category === "user_turn")
	const stepFiles = files.filter((f) => f.category !== "user_turn")

	const formatSessionTitle = (sessionDir) => {
		// Example: 2026-10-23--04-50-cumpleanos-en-barcelona
		const parts = sessionDir.split("-")
		if (parts.length >= 4) {
			const date = `${parts[0]}-${parts[1]}-${parts[2]}`
			const rest = parts.slice(3).join(" ").replace(/--/g, " ")
			return { date, title: rest.trim() || "Conversación" }
		}
		return { date: "", title: sessionDir }
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-950/80 backdrop-blur-md">
			<div className="flex flex-col h-[90vh] sm:h-[90dvh] w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
				{/* Top Modal Bar */}
				<header className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-slate-950/60">
					<div className="flex items-center gap-2.5">
						<div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
							<History className="w-5 h-5" />
						</div>
						<div>
							<h2 className="text-sm font-semibold text-white">Historial de Conversaciones y Memoria</h2>
							<p className="text-[11px] text-slate-400">Auditoría completa de turnos, memoria RAG y flujo de razonamiento</p>
						</div>
					</div>

					<button
						onClick={onClose}
						className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
						title="Cerrar"
					>
						<X className="w-5 h-5" />
					</button>
				</header>

				{/* Two-Column Layout: Left Slider/Sidebar + Right Body */}
				<div className="flex-1 min-h-0 h-full flex flex-col md:flex-row overflow-hidden">
					{/* Left Slider / Chat Session List */}
					<aside className="w-full md:w-80 h-44 md:h-full flex-shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-slate-800/80 bg-slate-950/40">
						{/* Search Bar */}
						<div className="p-3 border-b border-slate-800/60">
							<div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
								<Search className="w-3.5 h-3.5 text-slate-400" />
								<input
									type="text"
									placeholder="Buscar chats..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="bg-transparent w-full text-slate-200 placeholder-slate-500 focus:outline-none"
								/>
							</div>
						</div>

						{/* Conversations Scrollable List */}
						<div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
							{loadingConvs ? (
								<div className="p-4 text-center text-xs text-slate-500">Cargando conversaciones...</div>
							) : filteredConvs.length === 0 ? (
								<div className="p-4 text-center text-xs text-slate-500">No hay chats guardados aún</div>
							) : (
								filteredConvs.map((conv) => {
									const isSelected = selectedSession === conv.session_dir
									const { date, title } = formatSessionTitle(conv.session_dir)
									return (
										<button
											key={conv.session_dir}
											onClick={() => selectSession(conv.session_dir)}
											className={`w-full text-left p-3 rounded-xl transition-all border ${
												isSelected
													? "bg-sky-600/15 border-sky-500/40 text-white shadow-sm"
													: "bg-slate-900/60 hover:bg-slate-800/60 border-slate-800/60 text-slate-300"
											}`}
										>
											<div className="flex items-center justify-between gap-1 mb-1">
												<span className="text-[10px] font-mono text-sky-400/80 flex items-center gap-1">
													<Clock className="w-3 h-3" />
													{date}
												</span>
												<span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700/50">
													{conv.files_count} archivos
												</span>
											</div>
											<p className="text-xs font-medium capitalize truncate">{title}</p>
										</button>
									)
								})
							)}
						</div>
					</aside>

					{/* Right Body: Turns & Accordions */}
					<main className="flex-1 min-h-0 h-full overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-900/50 select-text">
						{!selectedSession ? (
							<div className="h-full flex items-center justify-center text-slate-500 text-xs">
								Selecciona una conversación del lateral izquierdo
							</div>
						) : loadingFiles ? (
							<div className="h-full flex items-center justify-center text-slate-500 text-xs">
								Cargando detalles de la conversación...
							</div>
						) : (
							<>
								{/* Tab Switcher: Turnos vs TreeNode */}
								<div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 flex-wrap gap-2">
									<div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800">
										<button
											type="button"
											onClick={() => setActiveTab("turns")}
											className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
												activeTab === "turns"
													? "bg-sky-600/20 text-sky-400 border border-sky-500/30 shadow-sm"
													: "text-slate-400 hover:text-slate-200"
											}`}
										>
											<History className="w-3.5 h-3.5" />
											<span>Turnos y Auditoría ({userTurnFiles.length})</span>
										</button>
										<button
											type="button"
											onClick={() => setActiveTab("tree")}
											className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
												activeTab === "tree"
													? "bg-sky-600/20 text-sky-400 border border-sky-500/30 shadow-sm"
													: "text-slate-400 hover:text-slate-200"
											}`}
										>
											<GitBranch className="w-3.5 h-3.5" />
											<span>Árbol TreeNode</span>
										</button>
									</div>

									{activeTab === "tree" && treeData && (
										<div className="flex items-center gap-2">
											<button
												type="button"
												onClick={collapseAllNodes}
												className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
											>
												Colapsar Todo
											</button>
											<button
												type="button"
												onClick={expandAllNodes}
												className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-900 border border-slate-800 text-sky-400 hover:bg-slate-800 transition-colors"
											>
												Expandir Todo
											</button>
										</div>
									)}
								</div>

								{/* Active Tab View */}
								{activeTab === "tree" ? (
									<div className="w-full min-w-0 max-w-full overflow-hidden space-y-3">
										<div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 flex items-center justify-between flex-wrap gap-2">
											<div className="flex items-center gap-2">
												<Database className="w-4 h-4 text-sky-400" />
												<span className="font-semibold text-slate-200">Estructura Jerárquica de Nodos (TreeNode RAG)</span>
											</div>
											<span className="text-[11px] text-slate-500 font-mono">
												Scroll horizontal activado • Nodos colapsados por defecto
											</span>
										</div>

										{!treeData || (!treeData.children && !treeData.name) ? (
											<div className="p-8 text-center text-xs text-slate-500 rounded-xl bg-slate-950/40 border border-slate-800">
												No hay estructura TreeNode registrada en esta sesión
											</div>
										) : (
											<div className="w-full min-w-0 max-w-full overflow-hidden p-3 rounded-2xl bg-slate-950/40 border border-slate-800/80">
												<TreeNodeItem
													node={treeData}
													path="root"
													level={0}
													expandedNodes={expandedNodes}
													onToggle={toggleNode}
												/>
											</div>
										)}
									</div>
								) : userTurnFiles.length === 0 ? (
									<div className="h-full flex items-center justify-center text-slate-500 text-xs">
										No hay registros de usuario en esta sesión
									</div>
								) : (
									userTurnFiles.map((uf, turnIdx) => {
										const isExpanded = !!expandedTurns[turnIdx]
										const content = fileContents[uf.filename] || ""

										// Extract User Message and LLM Final response from markdown
										const userMatch = content.match(/## 2\. Mensaje Actual del Usuario\s*>\s*(.*?)(?=\n---|\n## 3)/s)
										const userText = userMatch ? userMatch[1].trim() : uf.filename

								const respMatch = content.match(/## 3\. Respuesta Final Generada por el LLM\s*(.*)/s)
								const finalText = respMatch ? respMatch[1].trim() : ""

								const ragMatch = content.match(/### B\. Memoria RAG Jerárquica en Árbol \(TreeNode\)\s*```markdown\s*(.*?)\s*```/s)
								const ragText = ragMatch ? ragMatch[1].trim() : ""

								const sysMatch = content.match(/### A\. System Prompt Efectivo\s*```markdown\s*(.*?)\s*```/s)
								const sysText = sysMatch ? sysMatch[1].trim() : ""

								const historyMatch = content.match(/### C\. Historial Activo Reciente.*?\n(.*?)(?=\n---|\n## 2)/s)
								const historyText = historyMatch ? historyMatch[1].trim() : ""

								return (
									<div
										key={uf.filename}
										className="border border-slate-800 rounded-2xl bg-slate-950/70 shadow-md transition-all"
									>
										{/* Accordion Header: The User Message */}
										<button
											onClick={() => toggleTurn(turnIdx)}
											className={`w-full flex items-start sm:items-center justify-between p-4 text-left hover:bg-slate-900/50 transition-colors gap-3 ${
												isExpanded ? "rounded-t-2xl" : "rounded-2xl"
											}`}
										>
											<div className="flex items-start gap-3">
												<div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm shadow-sky-500/20">
													<User className="w-4 h-4" />
												</div>
												<div>
													<div className="flex items-center gap-2 mb-0.5">
														<span className="text-[11px] font-semibold text-sky-400">Turno #{turnIdx + 1}</span>
														<span className="text-[10px] text-slate-500 font-mono">{uf.filename}</span>
													</div>
													<p className="text-xs sm:text-sm font-medium text-slate-200 leading-snug line-clamp-2">
														{userText}
													</p>
												</div>
											</div>

											<div className="flex items-center gap-2 flex-shrink-0 text-slate-400">
												<span className="text-[11px] hidden sm:inline text-slate-500">
													{isExpanded ? "Plegar pasos" : "Ver pasos y memoria"}
												</span>
												<div className="p-1 rounded-lg bg-slate-800/80">
													{isExpanded ? (
														<ChevronDown className="w-4 h-4 text-sky-400" />
													) : (
														<ChevronRight className="w-4 h-4" />
													)}
												</div>
											</div>
										</button>

										{/* Accordion Body: Step-by-step breakdown */}
										{isExpanded && (
											<div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-900/40 space-y-4 text-xs rounded-b-2xl animate-in fade-in duration-200">
												{/* 1. Memory State Delivered */}
												<div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
													<div className="flex items-center gap-2 text-sky-400 font-semibold text-[11px] tracking-wide uppercase">
														<Database className="w-3.5 h-3.5" />
														<span>1. Memoria Entregada al LLM en este Turno</span>
													</div>

													{/* TreeNode RAG */}
													<div>
														<span className="text-[10px] font-semibold text-slate-400 block mb-1">
															Árbol Jerárquico de Memoria RAG (TreeNode):
														</span>
														<pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-400 whitespace-pre-wrap break-words max-h-96 overflow-y-auto select-text">
															{ragText || "[Sin memoria RAG activa]"}
														</pre>
													</div>

													{/* Last 10 Messages Window */}
													{historyText && (
														<div>
															<span className="text-[10px] font-semibold text-slate-400 block mb-1">
																Ventana Deslizante (Últimos 10 Mensajes):
															</span>
															<div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono space-y-1 whitespace-pre-wrap break-words max-h-96 overflow-y-auto select-text">
																{historyText}
															</div>
														</div>
													)}

													{/* System Prompt (Collapsible) */}
													<details className="text-[11px] group">
														<summary className="cursor-pointer text-slate-400 hover:text-slate-200 font-medium select-none flex items-center gap-1.5">
															<FileText className="w-3 h-3" />
															<span>Ver System Prompt efectivo</span>
														</summary>
														<pre className="mt-2 p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-400 whitespace-pre-wrap break-words max-h-80 overflow-y-auto select-text">
															{sysText}
														</pre>
													</details>
												</div>

												{/* 2. Intermediate Steps: Tools & Sub-Agents */}
												{stepFiles.length > 0 && (
													<div className="space-y-2.5">
														<div className="flex items-center gap-2 text-indigo-400 font-semibold text-[11px] tracking-wide uppercase">
															<Layers className="w-3.5 h-3.5" />
															<span>2. Pasos y Herramientas del Flujo de Inferencia</span>
														</div>

														<div className="space-y-2">
															{stepFiles.map((sf) => {
																const sContent = fileContents[sf.filename] || ""
																return (
																	<div
																		key={sf.filename}
																		className="p-3 rounded-xl bg-slate-950/80 border border-indigo-950/60 hover:border-indigo-800/60 transition-colors"
																	>
																		<div className="flex items-center justify-between gap-2 mb-2">
																			<div className="flex items-center gap-2">
																				{sf.category === "tool_call" ? (
																					<span className="px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[10px] font-semibold flex items-center gap-1">
																						<Wrench className="w-3 h-3" />
																						Herramienta
																					</span>
																				) : sf.category === "agent_execution" ? (
																					<span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-400 text-[10px] font-semibold flex items-center gap-1">
																						<Bot className="w-3 h-3" />
																						Sub-Agente
																					</span>
																				) : (
																					<span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-semibold flex items-center gap-1">
																						<Cpu className="w-3 h-3" />
																						Paso de Plan
																					</span>
																				)}
																				<span className="font-mono text-[11px] text-slate-300 font-medium">
																					{sf.filename}
																				</span>
																			</div>
																		</div>
																		<pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono whitespace-pre-wrap break-words max-h-96 overflow-y-auto select-text">
																			{sContent}
																		</pre>
																	</div>
																)
															})}
														</div>
													</div>
												)}

												{/* 3. Final Response */}
												{finalText && (
													<div className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-950/70 space-y-2">
														<div className="flex items-center gap-2 text-emerald-400 font-semibold text-[11px] tracking-wide uppercase">
															<CheckCircle2 className="w-3.5 h-3.5" />
															<span>3. Respuesta Final Generada por el LLM</span>
														</div>
														<div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words select-text">
															{finalText}
														</div>
													</div>
												)}
											</div>
										)}
									</div>
								)
							})
						)}
							</>
						)}
					</main>
				</div>
			</div>
		</div>
	)
}
