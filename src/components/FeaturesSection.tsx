"use client";

const FEATURES = [
  { icon: "💾", name: "Storage Engine", desc: "Page-based file storage with 4KB pages, record serialization, and linked page chains — just like PostgreSQL's heap files.", color: "#6C63FF" },
  { icon: "📝", name: "Query Parser", desc: "Full SQL parser supporting CREATE, SELECT, INSERT, UPDATE, DELETE with WHERE, ORDER BY, and LIMIT clauses.", color: "#00D9FF" },
  { icon: "🗄️", name: "Buffer Manager", desc: "LRU eviction buffer pool (64 frames) caching pages in memory. Dirty pages are flushed to disk on commit.", color: "#00FFA3" },
  { icon: "🌲", name: "B-Tree Indexing", desc: "Self-balancing B-Tree on PRIMARY KEY columns for O(log n) lookups, range scans, and automatic rebalancing.", color: "#FFB800" },
  { icon: "🔒", name: "Constraints", desc: "NOT NULL, UNIQUE, PRIMARY KEY, and type checking (INTEGER, TEXT, REAL, BOOLEAN) enforced at write time.", color: "#FF5A5F" },
  { icon: "📄", name: "Page Manager", desc: "Allocates, reads, and writes fixed-size pages. Manages free space, page headers, and record slots.", color: "#6C63FF" },
  { icon: "🤖", name: "ML Optimizer", desc: "Learns cost correction factors from execution history using exponential moving averages for smarter query planning.", color: "#00D9FF" },
  { icon: "📋", name: "Table Catalog", desc: "Metadata store for schemas, constraints, row counts, and statistics — analogous to pg_catalog.", color: "#00FFA3" },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="relative py-28 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#6C63FF] mb-3">Core Components</p>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl md:text-5xl mb-4">
            Every Part <span className="text-gradient">Built From Scratch</span>
          </h2>
          <p className="text-[#A8B2D1] max-w-xl mx-auto">Real DBMS internals — not wrappers around existing databases. Each component mirrors how production databases actually work.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.name}
              className="glass-card p-5 group animate-slide-up"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{ background: `${f.color}15` }}
              >
                {f.icon}
              </div>
              <h3 className="font-heading font-semibold text-sm text-white mb-2">{f.name}</h3>
              <p className="text-xs text-[#A8B2D1] leading-relaxed">{f.desc}</p>
              {/* Bottom glow line */}
              <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ color: f.color }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
