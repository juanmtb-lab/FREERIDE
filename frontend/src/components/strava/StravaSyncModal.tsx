"use client";

import { useEffect, useState } from "react";
import { X, RefreshCw, CheckCircle2, AlertCircle, ShieldCheck, Key } from "lucide-react";

interface StravaSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StravaSyncModal({ isOpen, onClose, onSuccess }: StravaSyncModalProps) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/v1/settings")
        .then(res => res.json())
        .then(data => {
          if (data.strava_access_token) {
            setToken(data.strava_access_token);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/v1/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error en la sincronización con Strava");
      }

      setSuccessMsg(data.message || "¡Sincronizado con Strava Premium sin duplicar actividades!");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Error al conectar con Strava");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-dark-muted hover:text-white p-2 rounded-xl transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-600/20 text-orange-500 flex items-center justify-center font-black text-xl">
            S
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Conectar Strava Premium</h2>
            <p className="text-xs text-dark-muted">Unificación directa sin duplicar rutas de Garmin</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center space-x-2 text-emerald-400 text-xs">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-muted mb-1.5 flex items-center space-x-1.5">
              <Key className="w-3.5 h-3.5 text-orange-500" />
              <span>Strava Access Token</span>
            </label>
            <input
              type="text"
              placeholder="Ej: e82f...a1b"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-dark-muted focus:outline-none focus:border-orange-500"
            />
            <p className="text-[11px] text-dark-muted mt-1.5 leading-normal">
              Introduce tu token de la API de Strava o tu clave personal. Las rutas se fusionarán automáticamente con las de tu Garmin Edge 130 por fecha y hora.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-dark-border text-xs text-dark-muted hover:text-white transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading || !token}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-orange-600/20 flex items-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sincronizando...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Fusionar con Strava</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
