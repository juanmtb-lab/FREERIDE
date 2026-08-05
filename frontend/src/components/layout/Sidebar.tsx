"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bike, Activity, UploadCloud, BrainCircuit } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Panel Principal", href: "/", icon: Activity },
    { name: "Subir Telemetría", href: "/upload", icon: UploadCloud },
    { name: "Entrenador AI", href: "/coach", icon: BrainCircuit },
  ];

  return (
    <aside className="w-64 bg-dark-card border-r border-dark-border flex flex-col justify-between hidden md:flex">
      <div>
        {/* Brand Logo & Name linking directly to Home page / */}
        <Link href="/" className="p-6 flex items-center space-x-3 border-b border-dark-border hover:opacity-90 transition cursor-pointer group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <Bike className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-wider text-white group-hover:text-orange-400 transition-colors">FREERIDE</h1>
            <p className="text-xs text-dark-accent font-medium">Garmin Edge 130 Telemetry</p>
          </div>
        </Link>

        {/* Navigation Links */}
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

      {/* Footer / System Status */}
      <div className="p-4 border-t border-dark-border">
        <div className="glass-panel p-3 rounded-xl text-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-medium">Sistema Local Activo</span>
            </span>
          </div>
          <p className="text-dark-muted text-[11px]">Garmin .FIT & 3D Engine OK</p>
        </div>
      </div>
    </aside>
  );
}
