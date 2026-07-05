"use client";
import { useState } from "react";

interface ArchBlock {
  id: string;
  icon: string;
  name: string;
  color: string;
  desc: string;
  details: string;
  algorithm: string;
}

const BLOCKS: ArchBlock[] = [
  { id: "user", icon: "👤", name: "User / SQL Query", color: "#A8B2D1", desc: "Raw SQL string submitted by the user.", details: "CREATE, SELECT, INSERT, UPDATE, DELETE, SHOW TABLES, DESCRIBE", algorithm: "Input validation & length checks" },
  { id: "parser", icon: "📝", name: "SQL Parser Agent", color: "#6C63FF", desc: "Tokenizes and parses SQL into an Abstract Syntax Tree with confidence scoring.", details: "Lexical analysis → token stream → AST nodes → type classification", algorithm: "Recursive descent parser with regex-based tokenizer" },
  { id: "security", icon: "🛡️", name: "Security Agent", color: "#FF5A5F", desc: "Detects SQL injection, validates identifiers, computes risk score.", details: "Pattern matching for UNION SELECT, stacked queries, tautologies, comment injection", algorithm: "Regex pattern bank + risk score accumulator (threshold: 50)" },
  { id: "planner", icon: "📊", name: "Query Planner", color: "#FFB800", desc: "Creates logical and physical execution plans with cost estimation.", details: "Chooses full-scan vs. index-scan, applies predicate pushdown, projection pruning", algorithm: "Cost-based: O(n) for full scan, O(log n) for index. Sort cost: O(n log n)" },
  { id: "optimizer", icon: "🤖", name: "ML Optimizer", color: "#00D9FF", desc: "Learns cost correction factors from historical executions.", details: "Exponential moving average (α=0.3) over estimated vs. actual cost pairs", algorithm: "correctionₜ = (1-α) × correctionₜ₋₁ + α × (actual/estimated)" },
  { id: "executor", icon: "⚡", name: "Execution Engine", color: "#00FFA3", desc: "Runs the physical plan against the storage engine's pages and indexes.", details: "B-Tree lookup for indexed columns, sequential scan for non-indexed, in-memory filter/sort", algorithm: "Volcano iterator model: open → next → close per operator" },
  { id: "buffer", icon: "🗄️", name: "Buffer Pool", color: "#6C63FF", desc: "LRU cache holding up to 64 pages in memory to avoid disk I/O.", details: "Pin/unpin protocol, dirty page tracking, frame eviction on capacity", algorithm: "LRU: evict frame with smallest lastUsed counter among unpinned frames" },
  { id: "storage", icon: "💾", name: "Storage Manager", color: "#00D9FF", desc: "Manages 4KB pages on disk. Each page holds records with a header.", details: "Page allocation, linked page chains per table, record slot management", algorithm: "Append-only pages, mark-deleted records, sequential page IDs" },
];

export default function ArchitectureSection() {
  const [selected, setSelected] = useState<ArchBlock | null>(null);

  return (
    <section id="architecture" className="relative py-28 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#00D9FF] mb-3">System Design</p>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl md:text-5xl mb-4">
            Interactive <span className="text-gradient">Architecture</span>
          </h2>
          <p className="text-[#A8B2D1] max-w-xl mx-auto">Click any component to explore its internals, algorithms, and data flow.</p>
        </div>

        {/* Pipeline */}
        <div className="flex flex-col items-center gap-2 mb-10">
          {BLOCKS.map((block, i) => (
            <div key={block.id} className="flex flex-col items-center animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <button
                onClick={() => setSelected(selected?.id === block.id ? null : block)}
                className={`group relative w-full max-w-md glass-card px-5 py-3.5 flex items-center gap-4 transition-all duration-300 cursor-pointer ${
                  selected?.id === block.id ? "ring-1" : ""
                }`}
                style={{ borderColor: selected?.id === block.id ? block.color : undefined, boxShadow: selected?.id === block.id ? `0 0 20px ${block.color}20` : undefined }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${block.color}15` }}>
                  {block.icon}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{block.name}</p>
                  <p className="text-[11px] text-[#A8B2D1] truncate">{block.desc}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={block.color} strokeWidth="2" className={`flex-shrink-0 transition-transform ${selected?.id === block.id ? "rotate-90" : ""}`}>
                  <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Detail panel */}
              {selected?.id === block.id && (
                <div className="w-full max-w-md mt-2 glass rounded-2xl p-5 animate-fade-scale" style={{ borderColor: `${block.color}30` }}>
                  <div className="grid grid-cols-1 gap-3 text-xs">
                    <div>
                      <p className="text-[#A8B2D1] mb-1 font-semibold uppercase tracking-wider text-[10px]">Description</p>
                      <p className="text-white/80">{block.desc}</p>
                    </div>
                    <div>
                      <p className="text-[#A8B2D1] mb-1 font-semibold uppercase tracking-wider text-[10px]">Workflow</p>
                      <p className="text-white/80 font-code text-[11px]">{block.details}</p>
                    </div>
                    <div>
                      <p className="text-[#A8B2D1] mb-1 font-semibold uppercase tracking-wider text-[10px]">Algorithm</p>
                      <p className="text-white/80 font-code text-[11px]">{block.algorithm}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Connector */}
              {i < BLOCKS.length - 1 && (
                <div className="flex flex-col items-center my-1">
                  <div className="w-px h-4 bg-gradient-to-b from-[#6C63FF]/40 to-transparent" />
                  <svg width="10" height="8" viewBox="0 0 10 8" className="text-[#6C63FF]/50"><polygon points="5,8 0,0 10,0" fill="currentColor" /></svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
