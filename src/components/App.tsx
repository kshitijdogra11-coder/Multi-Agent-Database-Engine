"use client";
import { useState, useEffect } from "react";
import Background from "./Background";
import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import FeaturesSection from "./FeaturesSection";
import ArchitectureSection from "./ArchitectureSection";
import ConsoleSection from "./ConsoleSection";
import DemoSection from "./DemoSection";
import PerformanceSection from "./PerformanceSection";
import ChatBox from "./ChatBox";
import DebugPanel from "./DebugPanel";
import Footer from "./Footer";

const SECTIONS = ["hero", "features", "architecture", "console", "demo", "performance"];

export default function App() {
  const [activeSection, setActiveSection] = useState("hero");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { threshold: 0.3 }
    );

    for (const id of SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen relative">
      <Background />
      <div className="relative z-10">
        <Navbar activeSection={activeSection} />
        <HeroSection />
        <FeaturesSection />
        <ArchitectureSection />
        <ConsoleSection />
        <DemoSection />
        <PerformanceSection />
        <Footer />
      </div>
      <ChatBox />
      <DebugPanel />
    </div>
  );
}
