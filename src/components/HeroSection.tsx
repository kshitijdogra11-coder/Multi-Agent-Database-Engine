"use client";
import { useState, useEffect } from "react";

const SQL_LINES = [
  "CREATE DATABASE MiniDB;",
  "SELECT * FROM users;",
  "INSERT INTO students VALUES (1, 'Alice', 20);",
  "UPDATE records SET score = 95;",
  "DELETE FROM logs WHERE age < 7;",
];

export default function HeroSection() {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = SQL_LINES[lineIdx];
    let timeout: NodeJS.Timeout;

    if (!isDeleting && charIdx < current.length) {
      timeout = setTimeout(() => {
        setDisplayText(current.slice(0, charIdx + 1));
        setCharIdx((c) => c + 1);
      }, 45 + Math.random() * 30);
    } else if (!isDeleting && charIdx >= current.length) {
      timeout = setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && charIdx > 0) {
      timeout = setTimeout(() => {
        setDisplayText(current.slice(0, charIdx - 1));
        setCharIdx((c) => c - 1);
      }, 25);
    } else {
      setIsDeleting(false);
      setLineIdx((i) => (i + 1) % SQL_LINES.length);
    }

    return () => clearTimeout(timeout);
  }, [charIdx, isDeleting, lineIdx]);

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center pt-16 px-4">
      <div className="max-w-5xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-8 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-[#00FFA3] animate-pulse" />
          <span className="text-xs text-[#A8B2D1] font-medium tracking-wide">Built From Scratch · B-Tree · LRU Buffer · Page Storage</span>
        </div>

        {/* Title */}
        <h1 className="font-heading font-bold text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight mb-6 animate-slide-up">
          <span className="text-gradient">MiniDB</span>{" "}
          <span className="text-white">Engine</span>
        </h1>

        <p className="text-lg sm:text-xl text-[#A8B2D1] max-w-2xl mx-auto mb-10 leading-relaxed animate-slide-up" style={{ animationDelay: "0.1s" }}>
          A Modern Database Engine Built from Scratch — with page-based storage, B-Tree indexes, LRU buffer caching, and a multi-agent AI query pipeline.
        </p>

        {/* SQL typing animation */}
        <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="inline-block glass-card px-6 py-4 mb-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-[#FF5A5F]/60" />
              <div className="w-3 h-3 rounded-full bg-[#FFB800]/60" />
              <div className="w-3 h-3 rounded-full bg-[#00FFA3]/60" />
              <span className="text-[10px] text-[#A8B2D1]/50 ml-2 font-code">minidb-console</span>
            </div>
            <div className="flex items-center gap-2 text-left">
              <span className="text-[#6C63FF] font-code text-sm">❯</span>
              <span className="font-code text-sm sm:text-base text-[#00D9FF]">{displayText}</span>
              <span className="w-0.5 h-5 bg-[#00D9FF] animate-pulse" />
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <a href="#console"
            className="group px-7 py-3 rounded-2xl bg-gradient-to-r from-[#6C63FF] to-[#00D9FF] text-white font-semibold text-sm shadow-xl shadow-[#6C63FF]/25 hover:shadow-[#6C63FF]/40 hover:scale-[1.03] active:scale-[0.97] transition-all duration-300 flex items-center gap-2"
          >
            <span>Launch Engine</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 transition-transform"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </a>
          <a href="#architecture"
            className="px-7 py-3 rounded-2xl glass text-white font-semibold text-sm hover:bg-white/5 transition-all duration-300 flex items-center gap-2"
          >
            <span>Explore Architecture</span>
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-20 max-w-3xl mx-auto animate-slide-up" style={{ animationDelay: "0.4s" }}>
          {[
            { value: "7", label: "AI Agents", color: "#6C63FF" },
            { value: "4KB", label: "Page Size", color: "#00D9FF" },
            { value: "O(log n)", label: "Index Speed", color: "#00FFA3" },
            { value: "64", label: "Buffer Frames", color: "#FFB800" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-4 text-center">
              <p className="font-heading font-bold text-2xl mb-0.5" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs text-[#A8B2D1]">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
