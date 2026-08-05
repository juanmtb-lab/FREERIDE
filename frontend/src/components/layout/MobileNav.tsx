"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, UploadCloud, BrainCircuit } from "lucide-react";

export default function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Inicio", href: "/", icon: Activity },
    { name: "Subir", href: "/upload", icon: UploadCloud },
    { name: "Entrenador AI", href: "/coach", icon: BrainCircuit },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-card/90 backdrop-blur-xl border-t border-dark-border px-4 py-2 flex items-center justify-around shadow-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center space-y-1 py-1 px-4 rounded-xl transition ${
              isActive
                ? "text-orange-400 font-bold"
                : "text-dark-muted hover:text-white"
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? "text-orange-400 scale-110" : ""}`} />
            <span className="text-[10px] font-medium">{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
