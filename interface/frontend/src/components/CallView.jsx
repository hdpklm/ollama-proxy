import React from "react"
import { Phone, PhoneOff, Mic, MicOff, VolumeX, Sparkles, MessageSquare } from "lucide-react"
import AudioVisualizer from "./AudioVisualizer"

export default function CallView({ callHook }) {
	const {
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
	} = callHook

	return (
		<div className="flex flex-col items-center justify-between h-full max-w-xl mx-auto px-4 py-6">
			{/* Header info */}
			<div className="flex flex-col items-center text-center">
				<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800/80 border border-slate-700/60 mb-2">
					<span
						className={`w-2 h-2 rounded-full ${
							status === "connected"
								? "bg-emerald-400 animate-pulse"
								: status === "connecting"
								? "bg-amber-400 animate-ping"
								: "bg-slate-500"
						}`}
					/>
					<span className="capitalize">{status}</span>
				</div>
				<h2 className="text-xl font-bold tracking-tight text-slate-100">AI Voice Call</h2>
				<p className="text-xs text-slate-400 mt-0.5">
					Real-time bidirectional speech conversation
				</p>
			</div>

			{/* Center Visualizer */}
			<div className="flex flex-col items-center my-auto">
				<AudioVisualizer
					isActive={isInCall}
					isAssistantSpeaking={isAssistantSpeaking}
					isListening={isInCall && !isAssistantSpeaking && !isMuted}
				/>

				{/* Active Live Subtitles */}
				<div className="w-full max-w-md min-h-[90px] flex flex-col justify-center items-center text-center px-4">
					{userTranscript && (
						<p className="text-sm font-medium text-emerald-400 mb-1 animate-fade-in">
							“{userTranscript}”
						</p>
					)}
					{assistantText && (
						<p className="text-sm text-slate-200 line-clamp-3">
							{assistantText}
						</p>
					)}
					{!userTranscript && !assistantText && isInCall && (
						<p className="text-xs text-slate-500 italic">
							Speak into your microphone. Say something...
						</p>
					)}
				</div>
			</div>

			{/* Control actions */}
			<div className="w-full flex flex-col items-center gap-4">
				{isInCall && isAssistantSpeaking && (
					<button
						onClick={interruptAssistant}
						className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full transition-all"
					>
						<VolumeX className="w-4 h-4" />
						Interrupt Assistant
					</button>
				)}

				<div className="flex items-center justify-center gap-6">
					{!isInCall ? (
						<button
							onClick={startCall}
							className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/40 transition-transform active:scale-95"
							title="Start Call"
						>
							<Phone className="w-7 h-7" />
						</button>
					) : (
						<>
							<button
								onClick={toggleMute}
								className={`flex items-center justify-center w-12 h-12 rounded-full border transition-all ${
									isMuted
										? "bg-rose-500/20 border-rose-500 text-rose-400"
										: "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
								}`}
								title={isMuted ? "Unmute" : "Mute"}
							>
								{isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
							</button>

							<button
								onClick={endCall}
								className="flex items-center justify-center w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/40 transition-transform active:scale-95"
								title="Hang Up"
							>
								<PhoneOff className="w-7 h-7" />
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	)
}
