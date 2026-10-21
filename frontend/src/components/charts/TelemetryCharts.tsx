"use client";

import { TelemetryPoint } from "@/types/telemetry";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area
} from "recharts";
import { Mountain, Gauge, Activity as HRIcon, Zap, RefreshCw } from "lucide-react";
import { formatTime } from "@/lib/utils";

interface TelemetryChartsProps {
  points?: TelemetryPoint[];
  hrZones?: Record<string, number>;
  onPointHover?: (index: number) => void;
  totalDistanceM?: number;
  movingTimeSec?: number;
  elevationGainM?: number;
  avgSpeedKmh?: number;
  maxSpeedKmh?: number;
  avgHr?: number;
  maxHr?: number;
  avgCadence?: number;
  avgWattsEst?: number;
  onRefreshTelemetry?: () => void;
  refreshingTelemetry?: boolean;
}

export default function TelemetryCharts({
  points,
  hrZones,
  onPointHover,
  movingTimeSec = 0,
  avgSpeedKmh,
  maxSpeedKmh,
  avgHr,
  maxHr,
  avgCadence,
  onRefreshTelemetry,
  refreshingTelemetry = false
}: TelemetryChartsProps) {
  const hasRealPoints = Array.isArray(points) && points.length > 2;
  const chartData: any[] = [];

  if (hasRealPoints && points) {
    // Preserve up to 250 real points so every real peak and valley from Garmin Connect is visible
    const targetNumPoints = 250;
    const step = Math.max(1, Math.floor(points.length / targetNumPoints));

    for (let i = 0; i < points.length; i += step) {
      const pt = points[i];
      chartData.push({
        index: i,
        distanceKm: Number((pt.distance_m / 1000).toFixed(2)),
        timeLabel: formatTime(pt.elapsed_time_sec || 0),
        altitude: pt.altitude_m !== undefined ? Math.round(pt.altitude_m) : undefined,
        speed: pt.speed_kmh !== undefined ? Number(pt.speed_kmh.toFixed(1)) : undefined,
        hr: pt.heart_rate && pt.heart_rate > 30 ? Math.round(pt.heart_rate) : undefined,
        cadence: pt.cadence !== undefined && pt.cadence >= 0 ? Math.round(pt.cadence) : undefined,
        gradient: pt.gradient_pct !== undefined ? Number(pt.gradient_pct.toFixed(1)) : 0,
        power: pt.estimated_power_w !== undefined ? Math.round(pt.estimated_power_w) : undefined
      });
    }
  }

  // Compute HR Zones strictly from real Garmin data (or real HR points)
  const normalizedHrZones: Record<string, number> = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 };
  let hasHrZones = false;

  if (hrZones && Object.keys(hrZones).length > 0) {
    Object.entries(hrZones).forEach(([k, v]) => {
      const upper = k.toUpperCase();
      if (normalizedHrZones[upper] !== undefined && typeof v === "number") {
        normalizedHrZones[upper] = Math.round(v);
        if (v > 0) hasHrZones = true;
      }
    });
  } else if (hasRealPoints && points) {
    const validHrs = points
      .map(p => p.heart_rate)
      .filter((h): h is number => typeof h === "number" && h > 35);
    if (validHrs.length > 0) {
      hasHrZones = true;
      const refMax = Math.max(maxHr || 185, ...validHrs);
      const counts = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 };
      validHrs.forEach(h => {
        const pct = (h / refMax) * 100;
        if (pct < 60) counts.Z1++;
        else if (pct < 70) counts.Z2++;
        else if (pct < 80) counts.Z3++;
        else if (pct < 90) counts.Z4++;
        else counts.Z5++;
      });
      const total = validHrs.length;
      normalizedHrZones.Z1 = Math.round((counts.Z1 / total) * 100);
      normalizedHrZones.Z2 = Math.round((counts.Z2 / total) * 100);
      normalizedHrZones.Z3 = Math.round((counts.Z3 / total) * 100);
      normalizedHrZones.Z4 = Math.round((counts.Z4 / total) * 100);
      normalizedHrZones.Z5 = Math.round((counts.Z5 / total) * 100);
    }
  }

  // Official Garmin Connect Zone Colors & Labels
  const zoneConfig = [
    { zone: "Z5", name: "Zona 5 · Máximo (>90%)", color: "#EF4444" },
    { zone: "Z4", name: "Zona 4 · Umbral (80-90%)", color: "#F97316" },
    { zone: "Z3", name: "Zona 3 · Aeróbico (70-80%)", color: "#10B981" },
    { zone: "Z2", name: "Zona 2 · Fácil (60-70%)", color: "#3B82F6" },
    { zone: "Z1", name: "Zona 1 · Calentamiento (<60%)", color: "#9CA3AF" }
  ];

  const hrZoneBarData = zoneConfig.map(z => {
    const pct = normalizedHrZones[z.zone] || 0;
    const secs = movingTimeSec > 0 ? Math.round((pct / 100) * movingTimeSec) : 0;
    return {
      ...z,
      pct,
      timeStr: formatTime(secs)
    };
  });

  const validHrs = chartData.map(d => d.hr).filter((h): h is number => h !== undefined && h > 35);
  const hasHrSeries = validHrs.length > 0;
  const minHrVal = hasHrSeries ? Math.max(40, Math.min(...validHrs) - 5) : 90;
  const maxHrVal = hasHrSeries ? Math.max(...validHrs) + 5 : 190;

  const validCads = chartData.map(d => d.cadence).filter((c): c is number => c !== undefined && c > 0);
  const hasCadenceSeries = validCads.length > 0;

  return (
    <div className="space-y-6">
      {!hasRealPoints && (
        <div className="glass-panel p-6 rounded-2xl border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">
              Puntos de telemetría detallada pendientes de descarga desde Strava
            </h3>
            <p className="text-xs text-dark-muted">
              FREERIDE no inventa curvas falsas. Pulsa el botón para descargar los Streams segundo a segundo directamente de Strava API.
            </p>
          </div>
          {onRefreshTelemetry && (
            <button
              onClick={onRefreshTelemetry}
              disabled={refreshingTelemetry}
              className="px-4 py-2.5 rounded-xl bg-[#FC4C02] hover:bg-[#e34402] text-white text-xs font-bold flex items-center space-x-2 shrink-0 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshingTelemetry ? "animate-spin" : ""}`} />
              <span>{refreshingTelemetry ? "Descargando de Strava..." : "Descargar Gráficas de Strava"}</span>
            </button>
          )}
        </div>
      )}

      {hasRealPoints && (
        <>
          {/* 1. Garmin Connect Heart Rate Chart (bpm) */}
          {hasHrSeries && (
            <div className="glass-panel p-5 rounded-2xl border border-rose-500/20">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <HRIcon className="w-4 h-4 text-rose-500" />
                  <span>Frecuencia Cardíaca (bpm)</span>
                </h3>
                <div className="flex items-center space-x-4 text-xs">
                  {avgHr && (
                    <span className="text-dark-muted">
                      Media: <strong className="text-white">{avgHr} bpm</strong>
                    </span>
                  )}
                  {maxHr && (
                    <span className="text-dark-muted">
                      Máx: <strong className="text-rose-400">{maxHr} bpm</strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    onMouseMove={(e) => {
                      if (e && e.activePayload && e.activePayload[0] && onPointHover) {
                        onPointHover(e.activePayload[0].payload.index);
                      }
                    }}
                  >
                    <defs>
                      <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.55} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#232D3F" vertical={false} />
                    <XAxis
                      dataKey="distanceKm"
                      stroke="#9CA3AF"
                      tickLine={false}
                      tick={{ fontSize: 11 }}
                      unit=" km"
                    />
                    <YAxis
                      stroke="#EF4444"
                      domain={[minHrVal, maxHrVal]}
                      tickLine={false}
                      tick={{ fontSize: 11 }}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#151C28",
                        borderColor: "#232D3F",
                        borderRadius: "12px",
                        color: "#FFF",
                        fontSize: "12px"
                      }}
                      labelFormatter={(val, payload) => {
                        const t = payload?.[0]?.payload?.timeLabel;
                        return `Distancia: ${val} km${t ? ` · Tiempo: ${t}` : ""}`;
                      }}
                      formatter={(val: any) => [`${val} bpm`, "Frecuencia Cardíaca"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="hr"
                      stroke="#EF4444"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#hrGradient)"
                      name="hr"
                      connectNulls
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 2. Garmin Connect Elevation Chart (m) */}
          <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Mountain className="w-4 h-4 text-emerald-400" />
                <span>Altitud (m)</span>
              </h3>
              <span className="text-xs text-dark-muted">Perfil topográfico real (Strava Streams)</span>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  onMouseMove={(e) => {
                    if (e && e.activePayload && e.activePayload[0] && onPointHover) {
                      onPointHover(e.activePayload[0].payload.index);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232D3F" vertical={false} />
                  <XAxis
                    dataKey="distanceKm"
                    stroke="#9CA3AF"
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    unit=" km"
                  />
                  <YAxis
                    stroke="#10B981"
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    domain={["dataMin - 10", "dataMax + 10"]}
                    width={45}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#151C28",
                      borderColor: "#232D3F",
                      borderRadius: "12px",
                      color: "#FFF",
                      fontSize: "12px"
                    }}
                    labelFormatter={(val, payload) => {
                      const g = payload?.[0]?.payload?.gradient;
                      return `Distancia: ${val} km${g !== undefined ? ` · Pendiente: ${g}%` : ""}`;
                    }}
                    formatter={(val: any) => [`${val} m`, "Altitud"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="altitude"
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#elevGradient)"
                    name="altitude"
                    connectNulls
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. Garmin Connect Speed (km/h) */}
          <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <span>Velocidad (km/h)</span>
              </h3>
              <div className="flex items-center space-x-4 text-xs">
                {avgSpeedKmh !== undefined && (
                  <span className="text-dark-muted">
                    Media: <strong className="text-white">{avgSpeedKmh} km/h</strong>
                  </span>
                )}
                {maxSpeedKmh !== undefined && (
                  <span className="text-dark-muted">
                    Máx: <strong className="text-cyan-400">{maxSpeedKmh} km/h</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  onMouseMove={(e) => {
                    if (e && e.activePayload && e.activePayload[0] && onPointHover) {
                      onPointHover(e.activePayload[0].payload.index);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232D3F" vertical={false} />
                  <XAxis
                    dataKey="distanceKm"
                    stroke="#9CA3AF"
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    unit=" km"
                  />
                  <YAxis stroke="#06B6D4" tickLine={false} tick={{ fontSize: 11 }} width={40} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#151C28",
                      borderColor: "#232D3F",
                      borderRadius: "12px",
                      color: "#FFF",
                      fontSize: "12px"
                    }}
                    labelFormatter={(val, payload) => {
                      const t = payload?.[0]?.payload?.timeLabel;
                      return `Distancia: ${val} km${t ? ` · Tiempo: ${t}` : ""}`;
                    }}
                    formatter={(val: any) => [`${val} km/h`, "Velocidad"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="speed"
                    stroke="#06B6D4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#speedGradient)"
                    name="speed"
                    connectNulls
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. Cadence & Power Chart */}
          <div className="glass-panel p-5 rounded-2xl border border-amber-500/20">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>
                  {hasCadenceSeries ? "Cadencia (rpm) & Potencia Estimada (W)" : "Potencia Estimada (W)"}
                </span>
              </h3>
              {avgCadence && (
                <span className="text-xs text-dark-muted">
                  Cadencia Media: <strong className="text-white">{avgCadence} rpm</strong>
                </span>
              )}
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232D3F" vertical={false} />
                  <XAxis
                    dataKey="distanceKm"
                    stroke="#9CA3AF"
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    unit=" km"
                  />
                  {hasCadenceSeries && (
                    <YAxis yAxisId="left" stroke="#A855F7" tickLine={false} tick={{ fontSize: 11 }} width={40} />
                  )}
                  <YAxis
                    yAxisId="right"
                    orientation={hasCadenceSeries ? "right" : "left"}
                    stroke="#F59E0B"
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    width={45}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#151C28",
                      borderColor: "#232D3F",
                      borderRadius: "12px",
                      color: "#FFF",
                      fontSize: "12px"
                    }}
                  />
                  {hasCadenceSeries && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="cadence"
                      stroke="#A855F7"
                      dot={false}
                      strokeWidth={2}
                      name="Cadencia (rpm)"
                      isAnimationActive={false}
                    />
                  )}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="power"
                    stroke="#F59E0B"
                    dot={false}
                    strokeWidth={2}
                    name="Potencia (W)"
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* 5. Official Garmin Heart Rate Time in Zones (Z1 - Z5) */}
      {hasHrZones && (
        <div className="glass-panel p-5 rounded-2xl border border-dark-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <HRIcon className="w-4 h-4 text-rose-500" />
              <span>Tiempo en Zonas de Frecuencia Cardíaca (Strava)</span>
            </h3>
            <span className="text-xs text-dark-muted">Zonas Z1 - Z5</span>
          </div>

          <div className="space-y-3">
            {hrZoneBarData.map((item) => (
              <div key={item.zone} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{item.name}</span>
                  <span className="text-dark-muted">
                    {movingTimeSec > 0 ? `${item.timeStr} · ` : ""}
                    <strong className="text-white">{item.pct}%</strong>
                  </span>
                </div>
                <div className="w-full h-3 bg-dark-bg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(item.pct, item.pct > 0 ? 2 : 0)}%`,
                      backgroundColor: item.color
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
