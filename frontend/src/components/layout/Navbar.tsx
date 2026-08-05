"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bike, UploadCloud, RefreshCw, LogOut, CheckCircle2 } from "lucide-react";
import GarminSyncModal from "@/components/garmin/GarminSyncModal";

export default function Navbar() {
  const [isGarminModalOpen, setIsGarminModalOpen] = useState(false);
  const [session, setSession] = useState<{ connected: boolean; email?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const checkSession = async () => {
    try {
      const res = await fetch("/api/v1/garmin/session");
      if (res.ok) {
        const data = await res.json();
        setSession(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleQuickRefresh = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/v1/garmin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error en la sincronización");
      }
      setSyncMessage(`¡Sincronizado! (${data.synced_count || 0} rutas)`);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setIsGarminModalOpen(true);
    } finally {
      setSyncing(false);
    }
  };

  const handleLogoutGarmin = async () => {
    if (confirm("¿Desconectar cuenta de Garmin Connect?")) {
      await fetch("/api/v1/garmin/session", { method: "DELETE" });
      setSession({ connected: false });
    }
  };

  return (
    <>
      <header className="h-16 bg-dark-card border-b border-dark-border px-6 flex items-center justify-between md:justify-end">
        {/* Mobile Brand Link to Home / */}
        <Link href="/" className="flex items-center space-x-2 md:hidden hover:opacity-90 transition cursor-pointer group">
          <Bike className="w-6 h-6 text-dark-accent group-hover:scale-105 transition-transform" />
          <span className="font-bold text-lg text-white tracking-wider group-hover:text-orange-400 transition-colors">FREERIDE</span>
        </Link>

        {/* User Status & Quick Actions */}
        <div className="flex items-center space-x-3">
          {session?.connected ? (
            <div className="flex items-center space-x-2 bg-dark-bg/80 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
              <span className="flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="hidden sm:inline">Garmin:</span>
                <span className="text-white max-w-[120px] truncate">{session.email}</span>
              </span>

              {/* Quick Refresh Icon Button */}
              <button
                onClick={handleQuickRefresh}
                disabled={syncing}
                title="Sincronizar ahora nuevas salidas de Garmin Connect"
                className="p-1 text-cyan-400 hover:text-white hover:bg-cyan-500/20 rounded-lg transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin text-amber-400" : ""}`} />
              </button>

              <button
                onClick={handleLogoutGarmin}
                title="Cerrar sesión de Garmin"
                className="p-1 text-dark-muted hover:text-rose-400 rounded-lg transition ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsGarminModalOpen(true)}
              className="flex items-center space-x-2 bg-dark-border hover:bg-dark-border/80 text-cyan-400 font-medium text-xs px-3.5 py-2 rounded-xl transition border border-cyan-500/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Conectar Garmin</span>
            </button>
          )}

          <Link
            href="/upload"
            className="flex items-center space-x-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-medium text-xs px-4 py-2 rounded-xl transition shadow-md shadow-orange-600/20"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Subir .FIT / .GPX</span>
          </Link>
        </div>
      </header>

      {syncMessage && (
        <div className="fixed top-20 right-6 z-50 glass-panel px-4 py-3 rounded-2xl border border-emerald-500/40 text-emerald-400 text-xs font-bold shadow-xl flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{syncMessage}</span>
        </div>
      )}

      <GarminSyncModal
        isOpen={isGarminModalOpen}
        onClose={() => setIsGarminModalOpen(false)}
        onSuccess={() => {
          checkSession();
          window.location.reload();
        }}
      />
    </>
  );
}
