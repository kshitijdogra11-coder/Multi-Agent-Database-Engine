"use client";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { id: "hero", label: "Home" },
  { id: "features", label: "Features" },
  { id: "architecture", label: "Architecture" },
  { id: "console", label: "Visualizer" },
  { id: "performance", label: "Performance" },
];

export default function Navbar({ activeSection }: { activeSection: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "glass-strong shadow-lg shadow-black/20" : ""}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button onClick={() => scrollTo("hero")} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#00D9FF] flex items-center justify-center shadow-lg shadow-[#6C63FF]/20 group-hover:shadow-[#6C63FF]/40 transition-shadow">
              <span className="text-sm font-bold text-white font-code">DB</span>
            </div>
            <span className="font-heading font-bold text-lg tracking-tight">
              Mini<span className="text-gradient">DB</span>
            </span>
          </button>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`relative px-3.5 py-2 text-[13px] font-medium rounded-lg transition-all duration-300 ${
                  activeSection === item.id
                    ? "text-white"
                    : "text-[#A8B2D1] hover:text-white"
                }`}
              >
                {item.label}
                {activeSection === item.id && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-gradient-to-r from-[#6C63FF] to-[#00D9FF]" />
                )}
              </button>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => scrollTo("console")}
              className="px-4 py-2 text-[13px] font-medium rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00D9FF] text-white shadow-lg shadow-[#6C63FF]/25 hover:shadow-[#6C63FF]/40 hover:scale-[1.03] active:scale-[0.97] transition-all duration-300"
            >
              Launch Engine
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
