"use client";
import { useState, useEffect, useCallback } from "react";

interface EngineData {
  tables: number;
  totalRows: number;
  bufferHitRate: number;
  bufferFrames: number;
  bufferAccesses: number;
  indexesLoaded: number;
  buffer: { frames: number; maxFrames: number; hitRate: number; accessCount: number; hitCount: number };
}

export default function PerformanceSection() {
  const [data, setData] = useState<EngineData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/engine");
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 4000); return () => clearInterval(i); }, [fetchData]);

  const hitPct = data ? Math.round((data.buffer.hitRate || 0) * 100) : 0;

  const gauges = [
    { label: "Cache Hit Rate", value: hitPct, max: 100, unit: "%", color: "#00FFA3", desc: "Buffer pool efficiency" },
    { label: "Pages Cached", value: data?.buffer.frames ?? 0, max: data?.buffer.maxFrames ?? 64, unit: "", color: "#6C63FF", desc: "Active buffer frames" },
    { label: "Tables", value: data?.tables ?? 0, max: 50, unit: "", color: "#00D9FF", desc: "Catalog entries" },
    { label: "Total Rows", value: data?.totalRows ?? 0, max: Math.max(100, data?.totalRows ?? 0), unit: "", color: "#FFB800", desc: "Across all tables" },
    { label: "Page Accesses", value: data?.buffer.accessCount ?? 0, max: Math.max(100, data?.buffer.accessCount ?? 0), unit: "", color: "#FF5A5F", desc: "Disk I/O requests" },
    { label: "Indexes", value: data?.indexesLoaded ?? 0, max: 20, unit: "", color: "#6C63FF", desc: "B-Tree instances" },
  ];

  return (
    <section id="performance" className="relative py-28 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#FFB800] mb-3">Live Metrics</p>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl md:text-5xl mb-4">
            Performance <span className="text-gradient">Dashboard</span>
          </h2>
          <p className="text-[#A8B2D1] max-w-xl mx-auto">Real-time engine statistics — buffer pool, storage, indexes — updated every 4 seconds.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gauges.map((g, i) => {
            const pct = g.max > 0 ? Math.min(100, (g.value / g.max) * 100) : 0;
            return (
              <div key={g.label} className="glass-card p-5 animate-slide-up" style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-white">{g.label}</p>
                    <p className="text-[10px] text-[#A8B2D1]">{g.desc}</p>
                  </div>
                  <p className="text-2xl font-heading font-bold" style={{ color: g.color }}>
                    {g.value}{g.unit}
                  </p>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: g.color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* DBMS concept mapping */}
        <div className="mt-12 glass rounded-2xl p-6">
          <h3 className="font-heading font-semibold text-sm text-white mb-4">How It Maps to Real DBMS Concepts</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { ours: "Storage Manager", theirs: "PostgreSQL heap files / InnoDB tablespace", icon: "💾" },
              { ours: "Buffer Manager", theirs: "PostgreSQL shared_buffers / InnoDB buffer pool", icon: "🗄️" },
              { ours: "B-Tree Index", theirs: "PostgreSQL B-Tree access method", icon: "🌲" },
              { ours: "Table Catalog", theirs: "pg_catalog / information_schema", icon: "📋" },
              { ours: "Query Planner", theirs: "PostgreSQL query optimizer", icon: "📊" },
              { ours: "ML Optimizer", theirs: "Adaptive query optimization (Oracle/DB2)", icon: "🤖" },
            ].map((m) => (
              <div key={m.ours} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.02] transition-colors">
                <span className="text-lg">{m.icon}</span>
                <span className="text-xs text-white font-medium flex-1">{m.ours}</span>
                <span className="text-[10px] text-[#A8B2D1]">≈ {m.theirs}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
