import React from "react"

export default function AudioVisualizer({ isActive, isAssistantSpeaking, isListening }) {
	return (
		<div className="relative flex items-center justify-center w-40 h-40 sm:w-64 sm:h-64 my-3 sm:my-6">
			{/* Outer pulsing ring */}
			<div
				className={`absolute inset-0 rounded-full transition-all duration-700 ${
					isAssistantSpeaking
						? "bg-sky-500/20 animate-ping"
						: isListening
						? "bg-emerald-500/20 animate-pulse"
						: "bg-slate-800/20"
				}`}
			/>

			{/* Middle decorative glow */}
			<div
				className={`absolute inset-4 rounded-full transition-all duration-500 ${
					isAssistantSpeaking
						? "bg-gradient-to-tr from-sky-600/40 to-indigo-600/40 blur-xl"
						: isListening
						? "bg-gradient-to-tr from-emerald-600/40 to-teal-600/40 blur-xl"
						: "bg-slate-800/40 blur-md"
				}`}
			/>

			{/* Central sphere */}
			<div
				className={`relative z-10 w-32 h-32 sm:w-40 sm:h-40 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 ${
					isAssistantSpeaking
						? "bg-gradient-to-br from-sky-500 to-indigo-700 shadow-sky-500/50 scale-105"
						: isListening
						? "bg-gradient-to-br from-emerald-500 to-teal-700 shadow-emerald-500/50 scale-100"
						: "bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-black/50"
				}`}
			>
				{/* Audio wave bars */}
				<div className="flex items-center gap-1.5 h-12">
					{[0.6, 1.2, 0.8, 1.5, 0.9].map((scale, i) => (
						<span
							key={i}
							className={`w-1.5 rounded-full transition-all duration-200 ${
								isAssistantSpeaking
									? "bg-white animate-pulse"
									: isListening
									? "bg-emerald-100 animate-bounce"
									: "bg-slate-500 h-2"
							}`}
							style={{
								height: isAssistantSpeaking || isListening ? `${24 * scale}px` : "6px",
								animationDelay: `${i * 120}ms`
							}}
						/>
					))}
				</div>
				<span className="text-xs font-medium tracking-wide mt-2 text-white/90">
					{isAssistantSpeaking ? "Assistant speaking" : isListening ? "Listening..." : "Idle"}
				</span>
			</div>
		</div>
	)
}
