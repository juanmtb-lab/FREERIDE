"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bike, UploadCloud, RefreshCw, LogOut, CheckCircle2, BrainCircuit } from "lucide-react";
import StravaConnectModal from "@/components/strava/StravaConnectModal";
import {
  getStravaAuthHeaders,
  saveStravaAuthClient,
  clearStravaAuthClient,
  purgeLegacyGarminCache
} from "@/lib/api";

export default function Navbar() {
  const [isStravaModalOpen, setIsStravaModalOpen] = useState(false);
  const [session, setSession] = useState<{ connected: boolean; athleteName?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const checkSession = async () => {
    purgeLegacyGarminCache();

    if (typeof window !== "undefined") {
      const cachedAthlete = localStorage.getItem("freeride_strava_athlete");
      const cachedAuth = localStorage.getItem("freeride_strava_auth");
      if (cachedAuth) {
        setSession({ connected: true, athleteName: cachedAthlete || "Atleta Strava" });
      }
    }

    try {
      const res = await fetch("/api/v1/strava/session", {
        cache: "no-store",
        headers: {
          ...getStravaAuthHeaders()
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setSession(data);
          return;
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkSession();
    const handleSynced = () => checkSession();
    window.addEventListener("strava-synced", handleSynced);
    return () => window.removeEventListener("strava-synced", handleSynced);
  }, []);

  const handleQuickRefresh = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/v1/strava/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getStravaAuthHeaders()
        },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error en la sincronización con Strava");
      }
      if (data.strava_auth) {
        saveStravaAuthClient(data.strava_auth, data.athleteName);
      }
      if (data.activities && Array.isArray(data.activities)) {
        try {
          localStorage.setItem("freeride_strava_activities_v4", JSON.stringify(data.activities));
        } catch {}
      }
      setSyncMessage(`¡Strava Sincronizado! (${data.synced_count || 0} rutas)`);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch {
      setIsStravaModalOpen(true);
    } finally {
      setSyncing(false);
    }
  };

  const handleLogoutStrava = async () => {
    if (confirm("¿Desconectar tu cuenta de Strava?")) {
      await fetch("/api/v1/strava/session", { method: "DELETE" });
      clearStravaAuthClient();
      setSession({ connected: false });
      window.location.reload();
    }
  };

  return (
    <>
      <header className="h-14 sm:h-16 bg-dark-card/95 backdrop-blur-md border-b border-dark-border px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
        {/* Mobile Brand Link */}
        <Link href="/" className="flex items-center space-x-2 md:hidden hover:opacity-90 transition cursor-pointer group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/20">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-base text-white tracking-wider group-hover:text-orange-400 transition-colors">
            FREERIDE
          </span>
        </Link>

        {/* AI Coach Banner Badge */}
        <Link
          href="/coach"
          className="hidden md:flex items-center space-x-2 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/20 border border-orange-500/30 px-3.5 py-1.5 rounded-xl hover:border-orange-500/60 transition group"
        >
          <BrainCircuit className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors">
            Entrenador AI Activo
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1"></span>
        </Link>

        {/* User Status & Quick Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {session?.connected ? (
            <div className="flex items-center space-x-1.5 sm:space-x-2 bg-dark-bg/80 border border-orange-500/40 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl">
              <span className="flex items-center space-x-1.5 text-[11px] sm:text-xs text-orange-400 font-semibold">
                <span className="w-4 h-4 rounded bg-[#FC4C02] text-white flex items-center justify-center font-black text-[10px]">
                  S
                </span>
                <span className="hidden sm:inline">Strava:</span>
                <span className="text-white max-w-[110px] sm:max-w-[150px] truncate">
                  {session.athleteName || "Conectado"}
                </span>
              </span>

              <button
                onClick={handleQuickRefresh}
                disabled={syncing}
                title="Sincronizar ahora nuevos entrenamientos de Strava"
                className="p-1 text-orange-400 hover:text-white hover:bg-orange-500/20 rounded-lg transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${syncing ? "animate-spin text-amber-400" : ""}`} />
              </button>

              <button
                onClick={handleLogoutStrava}
                title="Desconectar Strava"
                className="p-1 text-dark-muted hover:text-rose-400 rounded-lg transition ml-0.5"
              >
                <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsStravaModalOpen(true)}
              className="flex items-center space-x-1.5 bg-[#FC4C02] hover:bg-[#e34402] text-white font-bold text-[11px] sm:text-xs px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl transition shadow-md shadow-orange-600/20"
            >
              <span className="font-black text-xs">S</span>
              <span>Conectar Strava</span>
            </button>
          )}

          <Link
            href="/upload"
            className="hidden sm:flex items-center space-x-2 bg-dark-bg hover:bg-dark-border border border-dark-border text-white font-medium text-xs px-3.5 py-2 rounded-xl transition"
          >
            <UploadCloud className="w-4 h-4 text-orange-400" />
            <span>Subir .FIT / .GPX</span>
          </Link>
        </div>
      </header>

      {syncMessage && (
        <div className="fixed top-16 right-4 sm:right-6 z-50 glass-panel px-4 py-3 rounded-2xl border border-emerald-500/40 text-emerald-400 text-xs font-bold shadow-xl flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{syncMessage}</span>
        </div>
      )}

      <StravaConnectModal
        isOpen={isStravaModalOpen}
        onClose={() => setIsStravaModalOpen(false)}
        onSuccess={() => {
          checkSession();
          window.location.reload();
        }}
      />
    </>
  );
}
