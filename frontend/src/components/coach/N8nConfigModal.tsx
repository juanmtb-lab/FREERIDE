"use client";

import { useEffect, useState } from "react";
import { X, Workflow, CheckCircle2, Save, Link2 } from "lucide-react";

interface N8nConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function N8nConfigModal({ isOpen, onClose, onSaved }: N8nConfigModalProps) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/v1/settings")
        .then(res => res.json())
        .then(data => {
          if (data.n8n_webhook_url) {
            setWebhookUrl(data.n8n_webhook_url);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/v1/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n8n_webhook_url: webhookUrl })
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSaved();
        onClose();
      }, 1200);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-dark-muted hover:text-white p-2 rounded-xl transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
            <Workflow className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Motor N8N del Entrenador AI</h2>
            <p className="text-xs text-dark-muted">Conecta tu propio Workflow de N8N para procesar entrenamientos</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-muted mb-1.5 flex items-center space-x-1.5">
              <Link2 className="w-3.5 h-3.5 text-orange-400" />
              <span>URL del Webhook de N8N</span>
            </label>
            <input
              type="url"
              placeholder="https://n8n.tu-dominio.com/webhook/freeride-coach"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-dark-muted focus:outline-none focus:border-orange-500"
            />
            <p className="text-[11px] text-dark-muted mt-1.5 leading-normal">
              FREERIDE enviará tu perfil fisiológico (CTL, ATL, TSB, pulsaciones bpm y datos de rutas) a este Webhook de N8N para que tu Workflow responda con análisis y planes adaptativos.
            </p>
          </div>

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center space-x-2 text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>¡URL de N8N guardada correctamente!</span>
            </div>
          )}

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
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-orange-600/20 flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "Guardando..." : "Guardar Webhook N8N"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
