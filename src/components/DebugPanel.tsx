"use client";
import { useState, useEffect, useCallback } from "react";

interface DebugData {
  status: string;
  orchestrator: {
    history: Array<{ sql: string; result: { success: boolean; queryType: string }; timestamp: string }>;
    optimizerStats: { totalLearned: number; patterns: number };
    pgLoggingEnabled: boolean;
    debugMode: boolean;
  };
  engine: {
    tables: Array<{
      name: string;
      schema: Array<{ name: string; type: string }>;
      catalogRowCount: number;
      statsRowCount: number;
      pages: number;
      hasIndex: boolean;
    }>;
    engineStats: {
      tables: number;
      totalRows: number;
      bufferHitRate: number;
      bufferFrames: number;
      bufferAccesses: number;
      indexesLoaded: number;
    };
  };
  buffer: {
    frames: number;
    maxFrames: number;
    hitRate: number;
    accessCount: number;
    hitCount: number;
  };
  localHistory: Array<{
    id: number;
    queryText: string;
    queryType: string;
    status: string;
    executionTimeMs: number;
  }>;
}

export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "tables" | "history" | "buffer">("overview");

  const fetchDebugData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/debug");
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch debug data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDebugData();
      const interval = setInterval(fetchDebugData, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchDebugData]);

  const toggleDebugMode = async (enable: boolean) => {
    await fetch("/api/debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: enable ? "enableDebug" : "disableDebug" }),
    });
    fetchDebugData();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 w-12 h-12 rounded-xl glass flex items-center justify-center text-[#A8B2D1] hover:text-[#00D9FF] hover:border-[#00D9FF]/30 transition-all duration-300 group"
        title="Open Debug Panel"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m18 16 4-4-4-4" /><path d="m6 8-4 4 4 4" /><path d="m14.5 4-5 16" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 w-[420px] max-w-[calc(100vw-48px)] glass-strong rounded-2xl shadow-2xl shadow-black/40 animate-fade-scale overflow-hidden" style={{ maxHeight: "min(600px, 80vh)" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[#00D9FF]">⚙️</span>
          <span className="text-sm font-semibold text-white">Debug Panel</span>
          {data?.orchestrator.debugMode && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00FFA3]/15 text-[#00FFA3] font-medium">DEBUG ON</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchDebugData} className="text-[#A8B2D1] hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition" title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={loading ? "animate-spin" : ""}>
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" />
            </svg>
          </button>
          <button onClick={() => setIsOpen(false)} className="text-[#A8B2D1] hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {(["overview", "tables", "history", "buffer"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-[11px] font-medium transition ${activeTab === tab ? "text-[#00D9FF] border-b border-[#00D9FF]" : "text-[#A8B2D1] hover:text-white"}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(min(600px, 80vh) - 100px)" }}>
        {loading && !data ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-[#00D9FF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data ? (
          <p className="text-[#A8B2D1] text-xs text-center py-8">Failed to load debug data</p>
        ) : (
          <>
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="Tables" value={data.engine.engineStats.tables} color="#6C63FF" />
                  <StatCard label="Rows" value={data.engine.engineStats.totalRows} color="#00D9FF" />
                  <StatCard label="Queries" value={data.localHistory.length} color="#00FFA3" />
                </div>

                {/* Debug toggle */}
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white font-medium">Debug Mode</span>
                    <button
                      onClick={() => toggleDebugMode(!data.orchestrator.debugMode)}
                      className={`w-10 h-5 rounded-full transition-colors ${data.orchestrator.debugMode ? "bg-[#00FFA3]" : "bg-white/10"}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${data.orchestrator.debugMode ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-[#A8B2D1]">Enable verbose console logging for B-Tree and Orchestrator</p>
                </div>

                {/* ML Optimizer */}
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-white font-medium mb-2">ML Optimizer</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center">
                      <p className="text-lg font-bold text-[#FFB800]">{data.orchestrator.optimizerStats.patterns}</p>
                      <p className="text-[10px] text-[#A8B2D1]">Patterns Learned</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-[#00FFA3]">{data.orchestrator.optimizerStats.totalLearned}</p>
                      <p className="text-[10px] text-[#A8B2D1]">Total Samples</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "tables" && (
              <div className="space-y-2">
                {data.engine.tables.length === 0 ? (
                  <p className="text-[#A8B2D1] text-xs text-center py-4">No tables created yet</p>
                ) : (
                  data.engine.tables.map((t) => (
                    <div key={t.name} className="glass rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-white font-code">{t.name}</span>
                        <div className="flex items-center gap-2">
                          {t.hasIndex && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FFB800]/15 text-[#FFB800]">INDEXED</span>}
                          <span className="text-[10px] text-[#A8B2D1]">{t.catalogRowCount} rows</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {t.schema.map((col) => (
                          <span key={col.name} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#A8B2D1]">
                            {col.name}: <span className="text-[#00D9FF]">{col.type}</span>
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-white/5 flex gap-3 text-[10px] text-[#A8B2D1]">
                        <span>Pages: {t.pages}</span>
                        <span>Stats rows: {t.statsRowCount}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-1">
                {data.localHistory.length === 0 ? (
                  <p className="text-[#A8B2D1] text-xs text-center py-4">No queries executed yet</p>
                ) : (
                  data.localHistory.slice(0, 15).map((h) => (
                    <div key={h.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] transition">
                      <span className={`w-1.5 h-1.5 rounded-full ${h.status === "success" ? "bg-[#00FFA3]" : "bg-[#FF5A5F]"}`} />
                      <span className="text-[10px] font-code text-[#6C63FF] w-20 flex-shrink-0">{h.queryType}</span>
                      <span className="text-[10px] text-[#A8B2D1] truncate flex-1" title={h.queryText}>{h.queryText}</span>
                      <span className="text-[9px] text-[#A8B2D1]/50">{h.executionTimeMs.toFixed(1)}ms</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "buffer" && (
              <div className="space-y-4">
                {/* Buffer gauge */}
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white font-medium">Buffer Pool Usage</span>
                    <span className="text-sm font-bold text-[#6C63FF]">{data.buffer.frames}/{data.buffer.maxFrames}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#6C63FF] to-[#00D9FF] transition-all duration-500"
                      style={{ width: `${(data.buffer.frames / data.buffer.maxFrames) * 100}%` }} />
                  </div>
                </div>

                {/* Hit rate */}
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white font-medium">Cache Hit Rate</span>
                    <span className="text-sm font-bold text-[#00FFA3]">{Math.round(data.buffer.hitRate * 100)}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#00FFA3] transition-all duration-500"
                      style={{ width: `${data.buffer.hitRate * 100}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-[#A8B2D1]">
                    <span>Hits: {data.buffer.hitCount}</span>
                    <span>Total accesses: {data.buffer.accessCount}</span>
                  </div>
                </div>

                {/* LRU explanation */}
                <div className="text-[10px] text-[#A8B2D1] leading-relaxed">
                  <p className="font-medium text-white mb-1">How it works:</p>
                  <p>The buffer pool caches database pages in memory. When full, the Least Recently Used (LRU) page is evicted. Higher hit rate = faster queries.</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="glass rounded-lg p-2 text-center">
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] text-[#A8B2D1]">{label}</p>
    </div>
  );
}
