"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, UploadCloud, BrainCircuit } from "lucide-react";
import FreerideLogo from "@/components/layout/FreerideLogo";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Panel Principal", href: "/", icon: Activity },
    { name: "Subir Telemetría", href: "/upload", icon: UploadCloud },
    { name: "Entrenador AI", href: "/coach", icon: BrainCircuit }
  ];

  return (
    <aside className="w-64 bg-dark-card border-r border-dark-border flex flex-col justify-between hidden md:flex">
      <div>
        <Link
          href="/"
          className="p-6 flex items-center space-x-3 border-b border-dark-border hover:opacity-90 transition cursor-pointer group"
        >
          <FreerideLogo size="md" className="group-hover:scale-105 transition-transform" />
          <div>
            <h1 className="font-bold text-xl tracking-wider text-white group-hover:text-purple-400 transition-colors">
              FREERIDE
            </h1>
            <p className="text-xs text-dark-accent font-medium">Strava Telemetry & AI Coach</p>
          </div>
        </Link>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-dark-accent/15 text-dark-accent border border-dark-accent/30 font-semibold"
                    : "text-dark-muted hover:text-white hover:bg-dark-border/40"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-dark-border">
        <div className="glass-panel p-3 rounded-xl text-xs space-y-1">
          <div className="flex items-center justify-between text-purple-400">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
              <span className="font-medium">Motor Strava API v3</span>
            </span>
          </div>
          <p className="text-dark-muted text-[11px]">Streams Reales & Entrenador AI</p>
        </div>
      </div>
    </aside>
  );
}
