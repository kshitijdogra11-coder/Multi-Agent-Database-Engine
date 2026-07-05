"use client";
import { useState, useCallback } from "react";

const DEMO_STEPS = [
  { title: "1. Create a Table", sql: "CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INTEGER, branch TEXT)", desc: "Define a schema with constraints" },
  { title: "2. Insert Records", sql: "INSERT INTO students (id, name, age, branch) VALUES (1, 'John', 20, 'CSE'), (2, 'Rahul', 19, 'ECE'), (3, 'Aman', 21, 'CSE')", desc: "Batch insert with B-Tree indexing" },
  { title: "3. Query with Filter", sql: "SELECT name, age FROM students WHERE branch = 'CSE' ORDER BY age DESC", desc: "Full scan + filter + sort + projection" },
  { title: "4. Index Lookup", sql: "SELECT * FROM students WHERE id = 2", desc: "O(log n) B-Tree primary key lookup" },
  { title: "5. Update a Record", sql: "UPDATE students SET age = 22 WHERE name = 'John'", desc: "In-place update with index re-entry" },
  { title: "6. Check Results", sql: "SELECT * FROM students ORDER BY id", desc: "Verify all changes persisted" },
];

interface StepResult { success: boolean; data?: unknown; rowCount?: number; error?: string; executionTimeMs: number; queryType: string; }

export default function DemoSection() {
  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState<Record<number, StepResult>>({});
  const [loading, setLoading] = useState(false);
  const [allDone, setAllDone] = useState(false);

  const runStep = useCallback(async (idx: number) => {
    setLoading(true);
    try {
      const res = await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql: DEMO_STEPS[idx].sql }) });
      const data: StepResult = await res.json();
      setResults((r) => ({ ...r, [idx]: data }));
      if (idx < DEMO_STEPS.length - 1) {
        setCurrentStep(idx + 1);
      } else {
        setAllDone(true);
      }
    } catch (e) {
      setResults((r) => ({ ...r, [idx]: { success: false, error: String(e), executionTimeMs: 0, queryType: "UNKNOWN" } }));
    } finally {
      setLoading(false);
    }
  }, []);

  const runAll = useCallback(async () => {
    for (let i = 0; i < DEMO_STEPS.length; i++) {
      setCurrentStep(i);
      setLoading(true);
      try {
        const res = await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql: DEMO_STEPS[i].sql }) });
        const data: StepResult = await res.json();
        setResults((r) => ({ ...r, [i]: data }));
      } catch (e) {
        setResults((r) => ({ ...r, [i]: { success: false, error: String(e), executionTimeMs: 0, queryType: "UNKNOWN" } }));
      }
    }
    setAllDone(true);
    setLoading(false);
  }, []);

  return (
    <section id="demo" className="relative py-28 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#FF5A5F] mb-3">Guided Demo</p>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl md:text-5xl mb-4">
            Try It <span className="text-gradient">Step by Step</span>
          </h2>
          <p className="text-[#A8B2D1] max-w-xl mx-auto mb-6">Walk through a complete workflow — from creating a table to querying indexed data.</p>
          <button onClick={runAll} disabled={loading || allDone}
            className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${loading || allDone ? "bg-white/5 text-[#A8B2D1]/30" : "bg-gradient-to-r from-[#FFB800] to-[#FF5A5F] text-white shadow-lg shadow-[#FFB800]/20 hover:shadow-[#FFB800]/40 hover:scale-[1.02] active:scale-[0.98]"}`}
          >
            {allDone ? "✓ Demo Complete" : loading ? "Running…" : "▶ Run All Steps"}
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {DEMO_STEPS.map((step, i) => {
            const result = results[i];
            const isActive = i === currentStep;
            const isDone = !!result;

            return (
              <div key={i} className={`glass-card p-4 transition-all duration-300 ${isActive && !isDone ? "ring-1 ring-[#6C63FF]/40" : ""}`}>
                <div className="flex items-start gap-4">
                  {/* Step indicator */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all ${
                    isDone ? (result.success ? "bg-[#00FFA3]/15 text-[#00FFA3]" : "bg-[#FF5A5F]/15 text-[#FF5A5F]") : isActive ? "bg-[#6C63FF]/15 text-[#6C63FF]" : "bg-white/5 text-[#A8B2D1]/40"
                  }`}>
                    {isDone ? (result.success ? "✓" : "✗") : i + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-semibold text-white">{step.title}</h4>
                      {isDone && <span className="text-[10px] font-code text-[#A8B2D1]">{result.executionTimeMs.toFixed(1)}ms</span>}
                    </div>
                    <p className="text-[11px] text-[#A8B2D1] mb-2">{step.desc}</p>
                    <pre className="text-[11px] font-code text-[#00D9FF]/70 bg-white/[0.02] px-3 py-2 rounded-lg overflow-x-auto">{step.sql}</pre>

                    {/* Result table */}
                    {(() => {
                      if (!isDone || !result.success || !result.data || !Array.isArray(result.data) || result.data.length === 0) return null;
                      const rows = result.data as Record<string, unknown>[];
                      const cols = Object.keys(rows[0]);
                      return (
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full text-[11px]">
                            <thead><tr className="border-b border-white/5">
                              {cols.map((c) => <th key={c} className="text-left py-1 px-2 text-[#6C63FF] font-code uppercase">{c}</th>)}
                            </tr></thead>
                            <tbody>{rows.map((row, ri) => (
                              <tr key={ri} className="border-b border-white/[0.02]">
                                {cols.map((k) => <td key={k} className="py-1 px-2 text-white/70">{String(row[k])}</td>)}
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      );
                    })()}
                    {isDone && result.success && result.data != null && !Array.isArray(result.data) && (
                      <p className="mt-2 text-[11px] text-[#00FFA3] font-code">{String(JSON.stringify(result.data))}</p>
                    )}
                    {isDone && !result.success && (
                      <p className="mt-2 text-[11px] text-[#FF5A5F]">{result.error}</p>
                    )}
                  </div>

                  {/* Run button */}
                  {!isDone && (
                    <button onClick={() => runStep(i)} disabled={loading || (i > 0 && !results[i-1])}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                        loading || (i > 0 && !results[i-1]) ? "bg-white/5 text-[#A8B2D1]/20" : "bg-[#6C63FF]/15 text-[#6C63FF] hover:bg-[#6C63FF]/25"
                      }`}
                    >Run</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
