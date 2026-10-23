"use client";

import { useState } from "react";
import { UserProfile } from "@/types/auth";
import { saveUser, setCurrentUser } from "@/lib/auth";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Activity,
  Heart,
  Scale,
  Flame,
  Bike,
  Mountain,
  Compass,
  Zap,
  Gauge,
  Watch,
  CheckCircle2,
  Check
} from "lucide-react";

interface OnboardingModalProps {
  user: UserProfile;
  isOpen: boolean;
  onCompleted: () => void;
}

export default function OnboardingModal({ user, isOpen, onCompleted }: OnboardingModalProps) {
  const [step, setStep] = useState<1 | 2>(1);

  // Paso 1: Biometría & Disciplina
  const [age, setAge] = useState<string>(user.age ? String(user.age) : "32");
  const [weightKg, setWeightKg] = useState<string>(user.weightKg ? String(user.weightKg) : "72");
  const [heightCm, setHeightCm] = useState<string>(user.heightCm ? String(user.heightCm) : "178");
  const [experienceLevel, setExperienceLevel] = useState<UserProfile["experienceLevel"]>(
    user.experienceLevel || "INTERMEDIO"
  );
  const [primaryDiscipline, setPrimaryDiscipline] = useState<NonNullable<UserProfile["primaryDiscipline"]>>(
    user.primaryDiscipline || "MTB"
  );
  const [weeklyDaysTarget, setWeeklyDaysTarget] = useState<string>(
    user.weeklyDaysTarget ? String(user.weeklyDaysTarget) : "4"
  );
  const [weeklyHoursTarget, setWeeklyHoursTarget] = useState<string>(
    user.weeklyHoursTarget ? String(user.weeklyHoursTarget) : "6"
  );

  // Paso 2: Sensores, Ciclocomputador y Potencia
  const [bikeComputer, setBikeComputer] = useState<NonNullable<UserProfile["bikeComputer"]>>(
    user.bikeComputer || "GARMIN"
  );
  const [hasPowerMeter, setHasPowerMeter] = useState<boolean>(user.hasPowerMeter ?? false);
  const [heartRateSensorType, setHeartRateSensorType] = useState<NonNullable<UserProfile["heartRateSensorType"]>>(
    user.heartRateSensorType || "PECHO"
  );
  const [hasCadenceSensor, setHasCadenceSensor] = useState<boolean>(user.hasCadenceSensor ?? true);
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
      primaryDiscipline,
      weeklyDaysTarget: Number(weeklyDaysTarget) || 4,
      weeklyHoursTarget: Number(weeklyHoursTarget) || 6,
      bikeComputer,
      hasPowerMeter,
      hasHeartRateMonitor: heartRateSensorType !== "NINGUNO",
      heartRateSensorType,
      hasCadenceSensor,
      knownMaxHr: knownMaxHr ? Number(knownMaxHr) : undefined,
      knownFtp: knownFtp ? Number(knownFtp) : undefined
    };

    saveUser(updatedUser);
    setCurrentUser(updatedUser);
    onCompleted();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 pt-safe pb-safe overflow-y-auto">
      <div className="bg-dark-card border border-purple-500/40 rounded-3xl p-6 sm:p-8 max-w-xl w-full space-y-6 relative shadow-2xl animate-fade-in my-auto max-h-[88dvh] overflow-y-auto">
        {/* Cabecera con selector de pasos */}
        <div className="border-b border-dark-border pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white">¡Hola, {user.name}!</h2>
                <p className="text-xs text-dark-muted">Configura tu perfil ciclista para calibrar el Entrenador AI</p>
              </div>
            </div>

            <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Paso {step} de 2
            </span>
          </div>

          {/* Barra de progreso */}
          <div className="w-full bg-dark-bg h-1.5 rounded-full overflow-hidden flex">
            <div
              className={`h-full transition-all duration-300 bg-gradient-to-r from-purple-600 to-indigo-500 ${
                step === 1 ? "w-1/2" : "w-full"
              }`}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 1 ? (
            /* ========================================================= */
            /* PASO 1: Biometría, Disciplina Principal y Nivel           */
            /* ========================================================= */
            <>
              {/* Disciplina de Bicicleta Principal */}
              <div>
                <label className="block text-xs font-bold text-white mb-2 flex items-center space-x-1.5">
                  <Bike className="w-4 h-4 text-purple-400" />
                  <span>¿Qué disciplina practicas principalmente?</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: "MTB", label: "Montaña (MTB)", icon: Mountain, desc: "Senderos y trialeras" },
                    { id: "CARRETERA", label: "Carretera", icon: Bike, desc: "Asfalto y puertos" },
                    { id: "GRAVEL", label: "Gravel", icon: Compass, desc: "Pistas y aventura" },
                    { id: "MIXTO", label: "Mixto / Ambas", icon: Activity, desc: "Combino varias" }
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = primaryDiscipline === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPrimaryDiscipline(item.id as any)}
                        className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? "bg-purple-600/20 border-purple-500 text-white shadow-lg shadow-purple-600/20 ring-1 ring-purple-500"
                            : "bg-dark-bg/80 border-dark-border text-dark-muted hover:text-white hover:border-purple-500/40"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1.5">
                          <Icon className={`w-5 h-5 ${isSelected ? "text-purple-400" : "text-dark-muted"}`} />
                          {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{item.label}</p>
                          <p className="text-[10px] text-dark-muted leading-tight">{item.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Biometría básica */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-dark-muted mb-1">
                    Edad
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

              {/* Nivel de experiencia */}
              <div>
                <label className="block text-xs font-bold text-white mb-2 flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  <span>Nivel de Experiencia</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "PRINCIPIANTE", label: "Iniciación", desc: "1-2 años" },
                    { id: "INTERMEDIO", label: "Intermedio", desc: "Salidas habituales" },
                    { id: "AVANZADO", label: "Avanzado", desc: "Marchas / Gran fondo" },
                    { id: "COMPETICION", label: "Competición", desc: "Carreras / Máster" }
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setExperienceLevel(lvl.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        experienceLevel === lvl.id
                          ? "bg-purple-500/20 border-purple-500 text-white shadow-md shadow-purple-500/20 ring-1 ring-purple-500"
                          : "bg-dark-bg border-dark-border text-dark-muted hover:text-white"
                      }`}
                    >
                      <p className="text-xs font-bold">{lvl.label}</p>
                      <p className="text-[10px] text-dark-muted">{lvl.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Disponibilidad semanal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-dark-muted mb-1">
                    Días de entreno por semana
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
                    Horas semanales disponibles
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

              {/* Botón Siguiente */}
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-purple-600/30 transition flex items-center justify-center space-x-2"
              >
                <span>Continuar a Equipamiento y Sensores</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            /* ========================================================= */
            /* PASO 2: Equipamiento, Ciclocomputador y Sensores           */
            /* ========================================================= */
            <>
              {/* Ciclocomputador */}
              <div>
                <label className="block text-xs font-bold text-white mb-2 flex items-center space-x-1.5">
                  <Gauge className="w-4 h-4 text-purple-400" />
                  <span>¿Qué dispositivo o ciclocomputador utilizas?</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "GARMIN", label: "Garmin Edge" },
                    { id: "WAHOO", label: "Wahoo ELEMNT" },
                    { id: "HAMMERHEAD", label: "Hammerhead" },
                    { id: "BRYTON", label: "Bryton / IGPS" },
                    { id: "MOVIL", label: "Móvil / App" },
                    { id: "OTRO", label: "Otro reloj / GPS" },
                    { id: "NINGUNO", label: "Sin dispositivo" }
                  ].map((dev) => (
                    <button
                      key={dev.id}
                      type="button"
                      onClick={() => setBikeComputer(dev.id as any)}
                      className={`p-2.5 rounded-xl border text-center transition ${
                        bikeComputer === dev.id
                          ? "bg-purple-600/20 border-purple-500 text-white font-bold ring-1 ring-purple-500"
                          : "bg-dark-bg border-dark-border text-dark-muted hover:text-white"
                      }`}
                    >
                      <span className="text-xs">{dev.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sensores instalados: Potenciómetro, Pulsómetro, Cadencia */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-white flex items-center space-x-1.5">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span>Sensores y Telemetría Disponible</span>
                </label>

                {/* Potenciómetro Sí/No */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-dark-bg border border-dark-border">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                      ⚡
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Potenciómetro (Vatios / W)</p>
                      <p className="text-[10px] text-dark-muted">Pedales, bielas o araña medidora de potencia</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 bg-dark-card p-1 rounded-xl border border-dark-border">
                    <button
                      type="button"
                      onClick={() => setHasPowerMeter(false)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        !hasPowerMeter ? "bg-dark-bg text-white" : "text-dark-muted hover:text-white"
                      }`}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasPowerMeter(true)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        hasPowerMeter ? "bg-purple-600 text-white" : "text-dark-muted hover:text-white"
                      }`}
                    >
                      Sí
                    </button>
                  </div>
                </div>

                {/* Sensor de Frecuencia Cardíaca (Pulsómetro) */}
                <div className="p-3.5 rounded-2xl bg-dark-bg border border-dark-border space-y-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs">
                      ❤️
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Sensor de Pulsómetro (Frecuencia Cardíaca)</p>
                      <p className="text-[10px] text-dark-muted">Para calcular zonas metabólicas Z1 a Z5</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { id: "PECHO", label: "Banda de pecho", desc: "Más precisa (ECG)" },
                      { id: "RELOJ", label: "Sensor de muñeca", desc: "Reloj óptico" },
                      { id: "NINGUNO", label: "No utilizo", desc: "Sensaciones" }
                    ].map((sensor) => (
                      <button
                        key={sensor.id}
                        type="button"
                        onClick={() => setHeartRateSensorType(sensor.id as any)}
                        className={`p-2 rounded-xl border text-left transition ${
                          heartRateSensorType === sensor.id
                            ? "bg-purple-600/20 border-purple-500 text-white ring-1 ring-purple-500 font-bold"
                            : "bg-dark-card border-dark-border text-dark-muted hover:text-white"
                        }`}
                      >
                        <p className="text-xs">{sensor.label}</p>
                        <p className="text-[10px] text-dark-muted">{sensor.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sensor de Cadencia Sí/No */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-dark-bg border border-dark-border">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                      🔄
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Sensor de Cadencia (RPM)</p>
                      <p className="text-[10px] text-dark-muted">Sensor en biela para medir revoluciones por minuto</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 bg-dark-card p-1 rounded-xl border border-dark-border">
                    <button
                      type="button"
                      onClick={() => setHasCadenceSensor(false)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        !hasCadenceSensor ? "bg-dark-bg text-white" : "text-dark-muted hover:text-white"
                      }`}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasCadenceSensor(true)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        hasCadenceSensor ? "bg-purple-600 text-white" : "text-dark-muted hover:text-white"
                      }`}
                    >
                      Sí
                    </button>
                  </div>
                </div>
              </div>

              {/* Datos fisiológicos conocidos opcionales */}
              <div className="p-3.5 rounded-2xl bg-dark-bg/60 border border-dark-border space-y-2.5">
                <p className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-400" />
                  <span>Datos Fisiológicos Conocidos (Opcional)</span>
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

              {/* Botones Atrás y Guardar */}
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="py-3 px-4 rounded-2xl bg-dark-bg hover:bg-dark-border border border-dark-border text-white font-bold text-xs transition flex items-center space-x-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Atrás</span>
                </button>

                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-purple-600/30 transition flex items-center justify-center space-x-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar Perfil y Empezar a Entrenar</span>
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
