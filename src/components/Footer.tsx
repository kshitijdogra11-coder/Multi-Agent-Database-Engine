"use client";

export default function Footer() {
  return (
    <footer className="relative pt-20 pb-8 px-4 overflow-hidden">
      {/* Wave */}
      <div className="absolute bottom-0 left-0 right-0 h-20 overflow-hidden opacity-10">
        <svg viewBox="0 0 1440 100" className="absolute bottom-0 w-[200%] animate-wave" preserveAspectRatio="none">
          <path fill="url(#wg)" d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,30 1440,40 L1440,100 L0,100 Z" />
          <defs><linearGradient id="wg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#6C63FF" /><stop offset="50%" stopColor="#00D9FF" /><stop offset="100%" stopColor="#00FFA3" /></linearGradient></defs>
        </svg>
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Top */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#00D9FF] flex items-center justify-center shadow-lg shadow-[#6C63FF]/20">
              <span className="text-sm font-bold text-white font-code">DB</span>
            </div>
            <span className="font-heading font-bold text-lg">Mini<span className="text-gradient">DB</span></span>
          </div>
          <p className="text-sm text-[#A8B2D1] text-center max-w-md">A mini database engine built from scratch to understand how databases work internally.</p>
        </div>

        {/* Separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-6" />

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#A8B2D1]/50">© {new Date().getFullYear()} MiniDB Engine. Educational project.</p>
          <div className="flex items-center gap-6">
            {["Architecture", "Visualizer", "Performance"].map((link) => (
              <a key={link} href={`#${link.toLowerCase()}`} className="text-xs text-[#A8B2D1]/50 hover:text-white/70 transition">{link}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
