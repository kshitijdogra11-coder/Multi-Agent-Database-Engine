"use client";
import { useState, useRef, useEffect, useCallback } from "react";

interface AgentResult { agentName: string; status: string; confidence: number; durationMs: number; message: string; }
interface ExecResult { success: boolean; data?: unknown; rowCount?: number; error?: string; pipeline: AgentResult[]; executionTimeMs: number; queryType: string; }

const DEMO_QUERIES = [
  { label: "Create Table", sql: "CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INTEGER, branch TEXT)" },
  { label: "Insert Data", sql: "INSERT INTO students (id, name, age, branch) VALUES (1, 'John', 20, 'CSE'), (2, 'Rahul', 19, 'ECE'), (3, 'Aman', 21, 'CSE'), (4, 'Priya', 20, 'CSE')" },
  { label: "Select CSE", sql: "SELECT * FROM students WHERE branch = 'CSE'" },
  { label: "Index Lookup", sql: "SELECT * FROM students WHERE id = 2" },
  { label: "Order By", sql: "SELECT name, age FROM students ORDER BY age DESC" },
  { label: "Update", sql: "UPDATE students SET age = 22 WHERE name = 'John'" },
  { label: "Show Tables", sql: "SHOW TABLES" },
  { label: "Describe", sql: "DESCRIBE students" },
  { label: "Delete", sql: "DELETE FROM students WHERE id = 4" },
];

export default function ConsoleSection() {
  const [sql, setSql] = useState("");
  const [result, setResult] = useState<ExecResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ sql: string; result: ExecResult }>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const execute = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql: query }) });
      const data: ExecResult = await res.json();
      setResult(data);
      setHistory((h) => [{ sql: query, result: data }, ...h].slice(0, 20));
    } catch (e) {
      const errResult: ExecResult = { success: false, error: e instanceof Error ? e.message : "Network error", pipeline: [], executionTimeMs: 0, queryType: "UNKNOWN" };
      setResult(errResult);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); execute(sql); }
    if (e.key === "Tab") { e.preventDefault(); const t = e.target as HTMLTextAreaElement; const s = t.selectionStart; setSql(sql.substring(0, s) + "  " + sql.substring(t.selectionEnd)); setTimeout(() => { t.selectionStart = t.selectionEnd = s + 2; }, 0); }
  };

  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = "auto"; textareaRef.current.style.height = Math.max(80, textareaRef.current.scrollHeight) + "px"; } }, [sql]);

  const isTable = result?.success && Array.isArray(result.data) && result.data.length > 0;
  const tableData = isTable ? (result!.data as Record<string, unknown>[]) : [];
  const columns = isTable ? Object.keys(tableData[0]) : [];

  return (
    <section id="console" className="relative py-28 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#00FFA3] mb-3">Interactive</p>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl md:text-5xl mb-4">
            Database <span className="text-gradient">Visualizer</span>
          </h2>
          <p className="text-[#A8B2D1] max-w-xl mx-auto">Write SQL, see results, watch the agent pipeline — all in real time.</p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {DEMO_QUERIES.map((q) => (
            <button key={q.label} onClick={() => { setSql(q.sql); }}
              className="text-[11px] px-3 py-1.5 rounded-lg glass text-[#A8B2D1] hover:text-white hover:bg-white/5 transition-all duration-200 font-medium"
            >{q.label}</button>
          ))}
        </div>

        {/* Editor */}
        <div className="glass rounded-2xl overflow-hidden mb-6">
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#FF5A5F]/50" /><div className="w-3 h-3 rounded-full bg-[#FFB800]/50" /><div className="w-3 h-3 rounded-full bg-[#00FFA3]/50" />
              </div>
              <span className="text-[11px] text-[#A8B2D1]/40 font-code ml-2">sql-console</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#A8B2D1]/40">{sql.length} chars</span>
              <button onClick={() => setSql("")} className="text-[11px] text-[#A8B2D1]/50 hover:text-white/70 transition px-2 py-1 rounded">Clear</button>
            </div>
          </div>
          <div className="relative">
            <textarea ref={textareaRef} value={sql} onChange={(e) => setSql(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Enter SQL query…  (Ctrl+Enter to execute)"
              className="sql-editor w-full bg-transparent text-white px-5 py-4 resize-none min-h-[80px] text-sm placeholder:text-[#A8B2D1]/25"
              spellCheck={false} />
          </div>
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/5">
            <span className="text-[10px] text-[#A8B2D1]/30">⌘/Ctrl + Enter to execute</span>
            <button onClick={() => execute(sql)} disabled={loading || !sql.trim()}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${loading || !sql.trim() ? "bg-white/5 text-[#A8B2D1]/30 cursor-not-allowed" : "bg-gradient-to-r from-[#6C63FF] to-[#00D9FF] text-white shadow-lg shadow-[#6C63FF]/20 hover:shadow-[#6C63FF]/40 hover:scale-[1.02] active:scale-[0.98]"}`}
            >
              {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Running…</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>Execute</>}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="glass rounded-2xl overflow-hidden animate-fade-scale mb-6">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full ${result.success ? "bg-[#00FFA3]" : "bg-[#FF5A5F]"}`} />
                <span className="text-sm font-medium text-white">{result.success ? "Results" : "Error"}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-code ${result.success ? "bg-[#00FFA3]/10 text-[#00FFA3]" : "bg-[#FF5A5F]/10 text-[#FF5A5F]"}`}>{result.queryType}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#A8B2D1]">
                <span>{result.rowCount ?? 0} rows</span>
                <span className="text-white/10">|</span>
                <span>{result.executionTimeMs.toFixed(1)}ms</span>
              </div>
            </div>
            <div className="p-5">
              {!result.success && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-[#FF5A5F]/5 border border-[#FF5A5F]/15">
                  <span className="text-lg">✗</span>
                  <div><p className="text-[#FF5A5F] text-sm font-medium">Query Failed</p><p className="text-[#FF5A5F]/70 text-xs mt-1">{result.error}</p></div>
                </div>
              )}
              {isTable && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/5">{columns.map((c) => <th key={c} className="text-left py-2 px-3 text-[10px] font-semibold text-[#6C63FF] uppercase tracking-wider font-code">{c}</th>)}</tr></thead>
                    <tbody>
                      {tableData.map((row, i) => (
                        <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                          {columns.map((c) => {
                            const v = row[c];
                            return <td key={c} className="py-2.5 px-3">
                              {v === null || v === undefined ? <span className="text-[#A8B2D1]/30 italic text-xs">NULL</span> :
                              typeof v === "number" ? <span className="text-[#FFB800] font-code text-xs">{String(v)}</span> :
                              typeof v === "boolean" ? <span className={v ? "text-[#00FFA3]" : "text-[#FF5A5F]"}>{String(v)}</span> :
                              <span className="text-white/80 text-xs">{String(v)}</span>}
                            </td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result.success && !isTable && result.data != null && (
                <pre className="text-xs text-[#A8B2D1] font-code whitespace-pre-wrap">{String(JSON.stringify(result.data, null, 2))}</pre>
              )}
            </div>
          </div>
        )}

        {/* Pipeline */}
        {result && result.pipeline.length > 0 && (
          <div className="glass rounded-2xl p-5 animate-fade-scale">
            <h3 className="text-sm font-heading font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-lg">🔬</span>Agent Pipeline
            </h3>
            <div className="space-y-1.5">
              {result.pipeline.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.02] transition-colors animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${a.status === "success" ? "bg-[#00FFA3]" : a.status === "error" ? "bg-[#FF5A5F]" : "bg-[#FFB800]"}`} />
                  <span className="text-xs font-medium text-white w-36 truncate">{a.agentName}</span>
                  <span className="text-[11px] text-[#A8B2D1] flex-1 truncate">{a.message}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${a.confidence * 100}%`, background: a.confidence > 0.7 ? "#00FFA3" : a.confidence > 0.4 ? "#FFB800" : "#FF5A5F" }} />
                    </div>
                    <span className="text-[10px] text-[#A8B2D1]/60 w-12 text-right font-code">{a.durationMs.toFixed(1)}ms</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-[#A8B2D1]">Total pipeline</span>
              <span className="font-code text-[#00D9FF]">{result.executionTimeMs.toFixed(1)}ms</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
