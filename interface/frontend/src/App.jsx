import React, { useState, useEffect } from "react"
import { MessageSquare, Phone, Sparkles, Settings as SettingsIcon, Download } from "lucide-react"
import ChatView from "./components/ChatView"
import CallView from "./components/CallView"
import SettingsModal from "./components/SettingsModal"
import { useVoiceCall } from "./hooks/useVoiceCall"

export default function App() {
	const [activeTab, setActiveTab] = useState("call")
	const [isSettingsOpen, setIsSettingsOpen] = useState(false)
	const [deferredPrompt, setDeferredPrompt] = useState(null)

	useEffect(() => {
		const handleBeforeInstallPrompt = (e) => {
			e.preventDefault()
			setDeferredPrompt(e)
		}
		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
		return () => {
			window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
		}
	}, [])

	const handleInstallApp = async () => {
		if (!deferredPrompt) return
		deferredPrompt.prompt()
		const choice = await deferredPrompt.userChoice
		if (choice.outcome === "accepted") {
			setDeferredPrompt(null)
		}
	}

	const [settings, setSettings] = useState(() => {
		try {
			const saved = localStorage.getItem("voice_llm_settings")
			if (saved) {
				const parsed = JSON.parse(saved)
				return { aecMode: "native", ...parsed }
			}
		} catch (e) {}
		return { useBrowserTTS: false, useBrowserSTT: false, allowBargeIn: true, aecMode: "native" }
	})

	const handleUpdateSettings = (newVals) => {
		setSettings((prev) => {
			const updated = { ...prev, ...newVals }
			try {
				localStorage.setItem("voice_llm_settings", JSON.stringify(updated))
			} catch (e) {}
			return updated
		})
	}

	const callHook = useVoiceCall(settings)

	return (
		<div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 select-none overflow-hidden">
			{/* Top Bar Navigation */}
			<header className="flex items-center justify-between px-6 py-3 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md z-20">
				<div className="flex items-center gap-2.5">
					<div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20">
						<Sparkles className="w-4 h-4 text-white" />
					</div>
					<div>
						<h1 className="text-sm font-semibold tracking-wide text-white">Voice & Chat AI</h1>
						<p className="text-[10px] text-slate-400">
							{settings.useBrowserTTS ? "Browser TTS" : "Piper TTS"} +{" "}
							{settings.useBrowserSTT ? "Browser STT" : "Vosk STT"}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3">
					{/* Mode Switcher Tabs */}
					<div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
						<button
							onClick={() => setActiveTab("call")}
							className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
								activeTab === "call"
									? "bg-sky-600 text-white shadow-sm"
									: "text-slate-400 hover:text-slate-200"
							}`}
						>
							<Phone className="w-3.5 h-3.5" />
							<span>Call Mode</span>
						</button>

						<button
							onClick={() => setActiveTab("chat")}
							className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
								activeTab === "chat"
									? "bg-sky-600 text-white shadow-sm"
									: "text-slate-400 hover:text-slate-200"
							}`}
						>
							<MessageSquare className="w-3.5 h-3.5" />
							<span>Chat Mode</span>
						</button>
					</div>

					{/* PWA Install Button */}
					{deferredPrompt && (
						<button
							onClick={handleInstallApp}
							className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium shadow-md shadow-sky-600/30 transition-all animate-pulse"
							title="Instalar App en el dispositivo"
						>
							<Download className="w-3.5 h-3.5" />
							<span className="hidden sm:inline">Instalar</span>
						</button>
					)}

					{/* Settings Trigger */}
					<button
						onClick={() => setIsSettingsOpen(true)}
						className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
						title="Configuración de Voz"
					>
						<SettingsIcon className="w-4 h-4" />
					</button>
				</div>
			</header>

			{/* Main Content Area */}
			<main className="flex-1 relative overflow-hidden">
				{activeTab === "call" ? (
					<CallView callHook={callHook} />
				) : (
					<ChatView settings={settings} />
				)}
			</main>

			{/* Settings Modal */}
			<SettingsModal
				isOpen={isSettingsOpen}
				onClose={() => setIsSettingsOpen(false)}
				settings={settings}
				onUpdateSettings={handleUpdateSettings}
			/>
		</div>
	)
}
