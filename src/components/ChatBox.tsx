"use client";
import { useState, useRef, useEffect, useCallback } from "react";

interface Message { role: "user" | "assistant"; text: string; }

export default function ChatBox() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "👋 Hi! I'm the MiniDB assistant.\n\nI can help with SQL syntax, engine internals, architecture questions, and debugging.\n\nType 'help' to see all topics!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg }) });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.reply || "Sorry, I couldn't understand that." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }, [input]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300 ${open ? "bg-[#FF5A5F] rotate-45 shadow-[#FF5A5F]/30" : "bg-gradient-to-br from-[#6C63FF] to-[#00D9FF] shadow-[#6C63FF]/30 hover:shadow-[#6C63FF]/50 hover:scale-105"}`}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-48px)] glass-strong rounded-2xl shadow-2xl shadow-black/40 flex flex-col animate-fade-scale overflow-hidden" style={{ maxHeight: "min(500px, 70vh)" }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#00D9FF] flex items-center justify-center text-xs font-bold">DB</div>
            <div>
              <p className="text-sm font-semibold text-white">MiniDB Assistant</p>
              <p className="text-[10px] text-[#00FFA3]">Online</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: "200px" }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-slide-up`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-gradient-to-r from-[#6C63FF] to-[#6C63FF]/80 text-white rounded-br-md"
                    : "bg-white/5 text-[#A8B2D1] rounded-bl-md"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 px-4 py-3 rounded-2xl rounded-bl-md flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6C63FF] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6C63FF] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6C63FF] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-white/5">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
                placeholder="Ask about SQL, B-Trees, buffer pool…"
                className="flex-1 bg-white/5 text-white text-xs px-3.5 py-2.5 rounded-xl outline-none placeholder:text-[#A8B2D1]/30 focus:ring-1 focus:ring-[#6C63FF]/40 transition"
              />
              <button onClick={send} disabled={loading || !input.trim()}
                className={`p-2.5 rounded-xl transition-all ${loading || !input.trim() ? "text-[#A8B2D1]/20" : "text-[#6C63FF] hover:bg-[#6C63FF]/10"}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
