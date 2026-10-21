"use client";

import { useState, useEffect } from "react";
import { X, RefreshCw, Key, ShieldCheck, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { saveStravaAuthClient } from "@/lib/api";

interface StravaConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialError?: string | null;
}

export default function StravaConnectModal({ isOpen, onClose, onSuccess, initialError }: StravaConnectModalProps) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && typeof window !== "undefined") {
      if (initialError) {
        setError(initialError);
      }
      try {
        const savedCid = localStorage.getItem("freeride_strava_cid");
        const savedSec = localStorage.getItem("freeride_strava_csec");
        if (savedCid) setClientId(savedCid);
        if (savedSec) setClientSecret(savedSec);
      } catch {}
    }
  }, [isOpen, initialError]);

  if (!isOpen) return null;

  const handleOAuthRedirect = () => {
    const cleanCid = clientId.trim();
    const cleanSec = clientSecret.trim();
    if (!cleanCid || !cleanSec) {
      setError("Para autorizar en 1 clic con OAuth2, introduce primero tu Client ID y Client Secret de Strava.");
      return;
    }
    try {
      localStorage.setItem("freeride_strava_cid", cleanCid);
      localStorage.setItem("freeride_strava_csec", cleanSec);
    } catch {}

    const origin = window.location.origin;
    const redirectUri = `${origin}/`;
    const statePayload = btoa(JSON.stringify({ cid: cleanCid, csec: cleanSec }));

    const oauthUrl = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(
      cleanCid
    )}&response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&approval_prompt=force&scope=read,activity:read_all,profile:read_all&state=${encodeURIComponent(
      statePayload
    )}`;

    window.location.href = oauthUrl;
  };

  const handleDirectSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (clientId.trim()) localStorage.setItem("freeride_strava_cid", clientId.trim());
      if (clientSecret.trim()) localStorage.setItem("freeride_strava_csec", clientSecret.trim());

      const res = await fetch("/api/v1/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId.trim() || undefined,
          client_secret: clientSecret.trim() || undefined,
          access_token: accessToken.trim() || undefined,
          refresh_token: refreshToken.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error al conectar con Strava API");
      }

      if (data.strava_auth) {
        saveStravaAuthClient(data.strava_auth, data.athleteName);
      }
      if (data.activities && Array.isArray(data.activities)) {
        try {
          localStorage.setItem("freeride_strava_activities_v4", JSON.stringify(data.activities));
        } catch {}
      }

      window.dispatchEvent(new Event("strava-synced"));
      setSuccessMsg(data.message || "¡Sincronización con Strava completada!");
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Error al conectar con Strava");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg glass-panel p-6 sm:p-7 rounded-3xl border border-orange-500/30 shadow-2xl max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-dark-muted hover:text-white transition p-1.5"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-[#FC4C02] text-white flex items-center justify-center font-black text-xl shadow-lg shadow-orange-600/30">
            S
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white">Conectar Strava Oficial (API v3)</h3>
            <p className="text-xs text-dark-muted">
              Importación completa de historial, métricas y gráficas segundo a segundo (Streams)
            </p>
          </div>
        </div>

        <div className="mb-4 p-3.5 rounded-2xl bg-dark-bg/80 border border-dark-border text-xs text-dark-muted space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white">¿Dónde copio mis datos de Strava?</span>
            <a
              href="https://www.strava.com/settings/api"
              target="_blank"
              rel="noreferrer"
              className="text-orange-400 hover:underline inline-flex items-center space-x-1 font-semibold"
            >
              <span>Abrir strava.com/settings/api</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p className="text-[11px] leading-relaxed">
            1. Entra en <strong className="text-white">strava.com/settings/api</strong>.<br />
            2. Copia tu <strong className="text-white">ID de cliente (Client ID)</strong> y pulsa <strong className="text-white">&quot;Mostrar&quot;</strong> en <strong className="text-white">Secreto del cliente (Client Secret)</strong> para copiarlo.<br />
            3. Pulsa el botón naranja <strong className="text-orange-400">&quot;Autorizar con Strava en 1 Clic&quot;</strong> para importar todas tus actividades anteriores.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <div>{successMsg}</div>
          </div>
        )}

        <form onSubmit={handleDirectSync} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-dark-muted mb-1">
                ID de cliente (Client ID)
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Ej: 123456"
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-dark-muted mb-1">
                Secreto del cliente (Client Secret)
              </label>
              <input
                type="text"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Pega tu Secreto del cliente"
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleOAuthRedirect}
            className="w-full py-3 rounded-xl bg-[#FC4C02] hover:bg-[#e34402] text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-orange-600/30 transition flex items-center justify-center space-x-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Autorizar con Strava en 1 Clic (OAuth2 Completo)</span>
          </button>

          <div className="relative flex py-1.5 items-center">
            <div className="flex-grow border-t border-dark-border"></div>
            <span className="flex-shrink mx-3 text-[10px] text-dark-muted uppercase font-semibold">
              O conexión directa por Token
            </span>
            <div className="flex-grow border-t border-dark-border"></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-dark-muted mb-1 flex items-center space-x-1">
                <Key className="w-3 h-3 text-orange-400" />
                <span>Access Token</span>
              </label>
              <input
                type="text"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Pega tu Access Token"
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-dark-muted mb-1">
                Refresh Token (Opcional)
              </label>
              <input
                type="text"
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                placeholder="Pega tu Refresh Token"
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || (!accessToken && !refreshToken)}
            className="w-full py-2.5 rounded-xl bg-dark-bg hover:bg-dark-border border border-orange-500/40 text-orange-400 font-bold text-xs transition flex items-center justify-center space-x-2 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "Sincronizando historial de Strava..." : "Sincronizar con Token Directo"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
