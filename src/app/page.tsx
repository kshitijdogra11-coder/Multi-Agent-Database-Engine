"use client";

import dynamic from "next/dynamic";

const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#050816" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6C63FF] to-[#00D9FF] flex items-center justify-center animate-pulse">
          <span className="text-2xl">⚡</span>
        </div>
        <p className="text-[#A8B2D1] text-sm font-medium tracking-wide">Loading MiniDB Engine…</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <App />;
}
