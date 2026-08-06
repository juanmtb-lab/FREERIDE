"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadActivityFile } from "@/lib/api";
import { UploadCloud, CheckCircle2, AlertCircle, FileCode, Bike, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Selecciona un archivo .FIT o .GPX de tu dispositivo Garmin Edge 130");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const activity = await uploadActivityFile(file, title || undefined, description || undefined);
      router.push(`/activities/${activity.id}`);
    } catch (err: any) {
      setError(err.message || "Error al procesar el archivo");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 pt-1 sm:pt-0">
      <Link
        href="/"
        className="inline-flex items-center space-x-2 text-xs font-semibold text-dark-muted hover:text-white transition py-1"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Volver al Panel</span>
      </Link>

      <div className="glass-panel p-5 sm:p-8 rounded-3xl space-y-6 border border-dark-border">
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center space-x-3">
            <UploadCloud className="w-6 h-6 sm:w-7 sm:h-7 text-dark-accent" />
            <span>Subir Telemetría de Ciclismo</span>
          </h1>
          <p className="text-xs sm:text-sm text-dark-muted">
            Formatos soportados: <strong className="text-white">.FIT</strong> (Garmin Edge 130) y <strong className="text-white">.GPX</strong>.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-3 text-rose-400 text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition cursor-pointer flex flex-col items-center justify-center space-y-3 ${
              file
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-dark-border hover:border-dark-accent/50 bg-dark-card/40"
            }`}
          >
            <input
              type="file"
              accept=".fit,.gpx"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center space-y-2">
              {file ? (
                <>
                  <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-400" />
                  <div className="space-y-1">
                    <p className="font-bold text-white text-xs sm:text-sm">{file.name}</p>
                    <p className="text-xs text-dark-muted">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </>
              ) : (
                <>
                  <FileCode className="w-10 h-10 sm:w-12 sm:h-12 text-dark-accent" />
                  <div className="space-y-1">
                    <p className="font-bold text-white text-xs sm:text-sm">Arrastra tu archivo .FIT o .GPX aquí</p>
                    <p className="text-[11px] sm:text-xs text-dark-muted">o haz clic para explorar tu equipo</p>
                  </div>
                </>
              )}
            </label>
          </div>

          {/* Optional Title & Notes */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-dark-muted mb-1.5">
                Título de la Salida (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Salida MTB Sierra Norte / Entreno Series Carretera"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-dark-muted focus:outline-none focus:border-dark-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-dark-muted mb-1.5">
                Notas o Sensaciones (Opcional)
              </label>
              <textarea
                placeholder="Añade detalles sobre el terreno, condiciones climatológicas o sensaciones de fatiga..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-dark-muted focus:outline-none focus:border-dark-accent"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !file}
            className="w-full py-3.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-lg shadow-orange-600/20 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span>Procesando telemetría...</span>
            ) : (
              <>
                <Bike className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Analizar Telemetría & Generar 3D</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
