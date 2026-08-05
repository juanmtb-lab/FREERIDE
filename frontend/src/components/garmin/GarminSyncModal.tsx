"use client";

import { useState } from "react";
import { X, RefreshCw, Lock, Mail, AlertCircle, CheckCircle } from "lucide-react";

interface GarminSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function GarminSyncModal({ isOpen, onClose, onSuccess }: GarminSyncModalProps) {
  const [email, setEmail] = useState("juanmtb9@gmail.com");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/v1/garmin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Error al conectar con Garmin Connect");
      }

      setSuccessMsg(data.message || "¡Sincronización completada con éxito!");
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "No se pudo conectar con Garmin Connect. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md glass-panel p-6 rounded-2xl border border-dark-border shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-dark-muted hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Conectar Garmin Connect</h3>
            <p className="text-xs text-dark-muted">Sincronización directa en la Nube</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2.5">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <div>{successMsg}</div>
          </div>
        )}

        <form onSubmit={handleSync} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-muted mb-1.5">
              Correo Electrónico de Garmin Connect
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-dark-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full bg-dark-bg border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-muted mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-dark-muted" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-dark-bg border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-dark-bg/60 border border-dark-border text-[11px] text-dark-muted flex items-start space-x-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              Tus credenciales se procesan en tu propio servidor local FREERIDE de forma privada y nunca se comparten con terceros.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm shadow-lg shadow-orange-500/25 transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Sincronizando con Garmin Connect...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Iniciar Sincronización Automática</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
