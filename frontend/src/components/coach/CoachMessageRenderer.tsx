"use client";

import React from "react";
import {
  Activity,
  Heart,
  Zap,
  Mountain,
  Clock,
  Bike,
  CheckCircle2,
  Calendar,
  Flame,
  Gauge
} from "lucide-react";

interface CoachMessageRendererProps {
  content: string;
}

export default function CoachMessageRenderer({ content }: CoachMessageRendererProps) {
  if (!content) return null;

  // Split content by lines
  const rawLines = content.split("\n").map((l) => l.trim()).filter(Boolean);

  // Helper to parse inline **bold**
  const renderInlineFormatted = (text: string) => {
    // Replace **text** with bold tags
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const inner = part.slice(2, -2);
        return (
          <strong key={idx} className="font-extrabold text-white">
            {inner}
          </strong>
        );
      }
      // Check for *italic*
      const italicParts = part.split(/(\*[^*]+\*)/g);
      return italicParts.map((subPart, sIdx) => {
        if (subPart.startsWith("*") && subPart.endsWith("*")) {
          return (
            <span key={`${idx}-${sIdx}`} className="italic text-purple-300 font-semibold">
              {subPart.slice(1, -1)}
            </span>
          );
        }
        return subPart;
      });
    });
  };

  // Helper to classify icon for bullet lines
  const getBulletIcon = (line: string) => {
    const l = line.toLowerCase();
    if (l.includes("diagnóst") || l.includes("forma") || l.includes("tsb") || l.includes("ctl") || l.includes("atl")) {
      return <Activity className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
    }
    if (l.includes("distancia") || l.includes("desnivel") || l.includes("km") || l.includes("recorrido") || l.includes("puerto")) {
      return <Mountain className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />;
    }
    if (l.includes("duración") || l.includes("tiempo") || l.includes("intensidad") || l.includes("minut") || l.includes("zona")) {
      return <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
    }
    if (l.includes("pulsacion") || l.includes("coraz") || l.includes("fc") || l.includes("bpm") || l.includes("cardía")) {
      return <Heart className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />;
    }
    if (l.includes("potencia") || l.includes("vatio") || l.includes("watt") || l.includes("cadencia") || l.includes("rpm") || l.includes("w/kg")) {
      return <Zap className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />;
    }
    if (l.includes("nutri") || l.includes("hidrata") || l.includes("recuper") || l.includes("agua") || l.includes("sales")) {
      return <Flame className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />;
    }
    return <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />;
  };

  return (
    <div className="space-y-3 text-xs sm:text-sm text-dark-text leading-relaxed">
      {rawLines.map((line, idx) => {
        // 1. Numbered workout step/phase (e.g., "1. *Calentamiento...*" or "1. Calentamiento...")
        const phaseMatch = line.match(/^(\d+)\.\s*(.*)/);
        if (phaseMatch) {
          const stepNum = phaseMatch[1];
          const stepBody = phaseMatch[2];
          const isWarmup = stepNum === "1" || stepBody.toLowerCase().includes("calentam");
          const isMain = stepNum === "2" || stepBody.toLowerCase().includes("central") || stepBody.toLowerCase().includes("bloque") || stepBody.toLowerCase().includes("test") || stepBody.toLowerCase().includes("series");
          const isCooldown = Number(stepNum) >= 3 || stepBody.toLowerCase().includes("calma") || stepBody.toLowerCase().includes("enfriam");

          const badgeColor = isWarmup
            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
            : isMain
            ? "bg-purple-500/25 text-purple-300 border-purple-500/50"
            : "bg-blue-500/20 text-blue-300 border-blue-500/40";

          return (
            <div
              key={idx}
              className="p-3 sm:p-3.5 rounded-xl bg-dark-card/90 border border-dark-border/80 flex items-start space-x-3 shadow-sm hover:border-purple-500/40 transition"
            >
              <span
                className={`px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider border shrink-0 ${badgeColor}`}
              >
                Fase {stepNum}
              </span>
              <div className="text-gray-200 text-xs sm:text-[13px] leading-relaxed">
                {renderInlineFormatted(stepBody)}
              </div>
            </div>
          );
        }

        // 2. Heading for Structure (e.g. "• **Estructura de la Sesión:**" or "📋 Estructura...")
        if (line.toLowerCase().includes("estructura") && line.includes(":")) {
          return (
            <div key={idx} className="pt-2 pb-1 flex items-center space-x-2 text-purple-300 font-extrabold text-xs sm:text-sm">
              <span className="p-1 rounded-lg bg-purple-500/20 text-purple-400">
                <Bike className="w-3.5 h-3.5" />
              </span>
              <span>{renderInlineFormatted(line.replace(/^[•\-\*]\s*/, ""))}</span>
            </div>
          );
        }

        // 3. Bullet line with metric (e.g., "• **Distancia y Desnivel:** ...")
        if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*")) {
          const cleanLine = line.replace(/^[•\-\*]\s*/, "");
          return (
            <div
              key={idx}
              className="p-2.5 sm:p-3 rounded-xl bg-dark-bg/60 border border-dark-border/60 flex items-start space-x-2.5 hover:border-purple-500/30 transition"
            >
              {getBulletIcon(cleanLine)}
              <div className="text-gray-300 text-xs sm:text-[13px] leading-snug">
                {renderInlineFormatted(cleanLine)}
              </div>
            </div>
          );
        }

        // 4. Default clean paragraph
        return (
          <p key={idx} className="text-gray-300 text-xs sm:text-sm">
            {renderInlineFormatted(line)}
          </p>
        );
      })}
    </div>
  );
}
