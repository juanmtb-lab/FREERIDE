"use client";

import { useState } from "react";
import { UserProfile } from "@/types/auth";
import { saveUser, setCurrentUser } from "@/lib/auth";
import { Sparkles, ArrowRight, Activity, Heart, Scale, Flame } from "lucide-react";

interface OnboardingModalProps {
  user: UserProfile;
  isOpen: boolean;
  onCompleted: () => void;
}

export default function OnboardingModal({ user, isOpen, onCompleted }: OnboardingModalProps) {
  const [age, setAge] = useState<string>(user.age ? String(user.age) : "32");
  const [weightKg, setWeightKg] = useState<string>(user.weightKg ? String(user.weightKg) : "72");
  const [heightCm, setHeightCm] = useState<string>(user.heightCm ? String(user.heightCm) : "178");
  const [experienceLevel, setExperienceLevel] = useState<UserProfile["experienceLevel"]>(
    user.experienceLevel || "INTERMEDIO"
  );
  const [weeklyDaysTarget, setWeeklyDaysTarget] = useState<string>(
    user.weeklyDaysTarget ? String(user.weeklyDaysTarget) : "4"
  );
  const [weeklyHoursTarget, setWeeklyHoursTarget] = useState<string>(
    user.weeklyHoursTarget ? String(user.weeklyHoursTarget) : "6"
  );
  const [knownMaxHr, setKnownMaxHr] = useState<string>(
    user.knownMaxHr ? String(user.knownMaxHr) : ""
  );
  const [knownFtp, setKnownFtp] = useState<string>(
    user.knownFtp ? String(user.knownFtp) : ""
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedUser: UserProfile = {
      ...user,
      onboardingCompleted: true,
      age: Number(age) || undefined,
      weightKg: Number(weightKg) || undefined,
      heightCm: Number(heightCm) || undefined,
      experienceLevel,
      weeklyDaysTarget: Number(weeklyDaysTarget) || 4,
      weeklyHoursTarget: Number(weeklyHoursTarget) || 6,
      knownMaxHr: knownMaxHr ? Number(knownMaxHr) : undefined,
      knownFtp: knownFtp ? Number(knownFtp) : undefined
    };

    saveUser(updatedUser);
    setCurrentUser(updatedUser);
    onCompleted();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-dark-card border border-purple-500/40 rounded-3xl p-6 sm:p-8 max-w-xl w-full space-y-6 relative shadow-2xl animate-fade-in my-8">
        <div className="flex items-center space-x-3.5 border-b border-dark-border pb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">¡Bienvenido a FREERIDE, {user.name}!</h2>
            <p className="text-xs text-dark-muted">Cuestionario Fisiológico Inicial para calibrar tu Entrenador AI</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Fila 1: Biometría básica */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-dark-muted mb-1 flex items-center space-x-1">
                <span>Edad</span>
              </label>
              <input
                type="number"
                required
                min={12}
                max={99}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-dark-muted mb-1 flex items-center space-x-1">
                <Scale className="w-3 h-3 text-purple-400" />
                <span>Peso (kg)</span>
              </label>
              <input
                type="number"
                required
                step="0.5"
                min={35}
                max={160}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-dark-muted mb-1">
                Altura (cm)
              </label>
              <input
                type="number"
                required
                min={120}
                max={225}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Fila 2: Nivel de experiencia */}
          <div>
            <label className="block text-xs font-semibold text-dark-muted mb-2 flex items-center space-x-1">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>Nivel de Experiencia en Ciclismo</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "PRINCIPIANTE", label: "Iniciación", desc: "1-2 años" },
                { id: "INTERMEDIO", label: "Intermedio", desc: "Salidas habituales" },
                { id: "AVANZADO", label: "Avanzado", desc: "Gran fondo / Marchas" },
                { id: "COMPETICION", label: "Competición", desc: "Carreras / Máster" }
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setExperienceLevel(lvl.id as any)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    experienceLevel === lvl.id
                      ? "bg-purple-500/20 border-purple-500 text-white shadow-md shadow-purple-500/20"
                      : "bg-dark-bg border-dark-border text-dark-muted hover:text-white"
                  }`}
                >
                  <p className="text-xs font-bold">{lvl.label}</p>
                  <p className="text-[10px] text-dark-muted">{lvl.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Fila 3: Disponibilidad semanal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-dark-muted mb-1">
                Días de entrenamiento por semana
              </label>
              <select
                value={weeklyDaysTarget}
                onChange={(e) => setWeeklyDaysTarget(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-purple-500"
              >
                <option value="2">2 días / semana</option>
                <option value="3">3 días / semana</option>
                <option value="4">4 días / semana (Recomendado)</option>
                <option value="5">5 días / semana</option>
                <option value="6">6 días / semana</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-muted mb-1">
                Horas semanales estimadas
              </label>
              <input
                type="number"
                min={2}
                max={30}
                value={weeklyHoursTarget}
                onChange={(e) => setWeeklyHoursTarget(e.target.value)}
                placeholder="Ej: 6"
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Fila 4: Datos fisiológicos conocidos (Opcionales) */}
          <div className="p-4 rounded-2xl bg-dark-bg/70 border border-dark-border space-y-3">
            <p className="text-xs font-bold text-white flex items-center space-x-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              <span>Datos Fisiológicos Conocidos (Opcional)</span>
            </p>
            <p className="text-[11px] text-dark-muted leading-tight">
              Si no los sabes, déjalos vacíos; FREERIDE los calculará automáticamente al sincronizar tus salidas de Strava o hacer tu test FTP.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-dark-muted mb-1">
                  FC Máxima conocida (bpm)
                </label>
                <input
                  type="number"
                  placeholder="Ej: 185"
                  value={knownMaxHr}
                  onChange={(e) => setKnownMaxHr(e.target.value)}
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-dark-muted mb-1 flex items-center space-x-1">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>FTP estimado (W)</span>
                </label>
                <input
                  type="number"
                  placeholder="Ej: 240"
                  value={knownFtp}
                  onChange={(e) => setKnownFtp(e.target.value)}
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-purple-600/30 transition flex items-center justify-center space-x-2"
          >
            <span>Guardar Perfil y Empezar a Entrenar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
