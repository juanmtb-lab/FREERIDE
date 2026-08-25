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
import { Mountain, Gauge, Activity as HRIcon, Zap } from "lucide-react";

interface TelemetryChartsProps {
  points: TelemetryPoint[];
  hrZones?: Record<string, number>;
  onPointHover?: (index: number) => void;
}

export default function TelemetryCharts({ points, hrZones, onPointHover }: TelemetryChartsProps) {
  if (!points || points.length === 0) return null;

  // Downsample to 80 points for clean visual curves
  const targetNumPoints = 80;
  const step = Math.max(1, Math.floor(points.length / targetNumPoints));

  const chartData: any[] = [];
  for (let i = 0; i < points.length; i += step) {
    const slice = points.slice(i, Math.min(points.length, i + step));
    const avgAlt = slice.reduce((a, p) => a + (p.altitude_m || 0), 0) / slice.length;
    const avgSpeed = slice.reduce((a, p) => a + (p.speed_kmh || 0), 0) / slice.length;
    const avgSlope = slice.reduce((a, p) => a + (p.gradient_pct || 0), 0) / slice.length;
    const avgPower = slice.reduce((a, p) => a + (p.estimated_power_w || 0), 0) / slice.length;

    const hrs = slice.map(p => p.heart_rate).filter((h): h is number => !!h && h > 30);
    const avgHr = hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined;

    const cads = slice.map(p => p.cadence).filter((c): c is number => c !== undefined && c > 0);
    const avgCad = cads.length > 0 ? Math.round(cads.reduce((a, b) => a + b, 0) / cads.length) : 0;

    const pt = points[i];
    chartData.push({
      index: i,
      distanceKm: (pt.distance_m / 1000).toFixed(1),
      altitude: Math.round(avgAlt),
      speed: parseFloat(avgSpeed.toFixed(1)),
      hr: avgHr,
      cadence: avgCad,
      gradient: parseFloat(avgSlope.toFixed(1)),
      power: Math.round(avgPower)
    });
  }

  // Parse & format HR Zones
  const zoneColors: Record<string, string> = {
    Z1: "#3B82F6", // Blue - Recovery
    Z2: "#10B981", // Green - Endurance
    Z3: "#F59E0B", // Yellow - Tempo
    Z4: "#EF4444", // Red - Threshold
    Z5: "#8B5CF6"  // Purple - Anaerobic
  };

  const zoneLabels: Record<string, string> = {
    Z1: "Zona 1 - Calentamiento / Suave (<60%)",
    Z2: "Zona 2 - Resistencia (60-70%)",
    Z3: "Zona 3 - Aeróbica (70-80%)",
    Z4: "Zona 4 - Umbral (80-90%)",
    Z5: "Zona 5 - Máximo (>90%)"
  };

  const normalizedHrZones: Record<string, number> = { Z1: 8, Z2: 44, Z3: 33, Z4: 12, Z5: 3 };
  if (hrZones && Object.keys(hrZones).length > 0) {
    Object.entries(hrZones).forEach(([k, v]) => {
      const upper = k.toUpperCase();
      if (normalizedHrZones[upper] !== undefined) {
        normalizedHrZones[upper] = Math.round(v);
      }
    });
  }

  const hrZoneBarData = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map(zone => ({
    zone,
    label: zoneLabels[zone] || zone,
    pct: normalizedHrZones[zone] || 0,
    color: zoneColors[zone] || "#FF5722"
  }));

  // Dynamic Y-Axis scale for cadence
  const validCads = chartData.map(d => d.cadence).filter((c): c is number => c !== undefined && c > 0);
  const minCad = validCads.length > 0 ? Math.max(0, Math.min(...validCads) - 10) : 40;
  const maxCad = validCads.length > 0 ? Math.max(...validCads) + 10 : 120;

  return (
    <div className="space-y-6">
      {/* 1. Elevation Profile & Real Slope % */}
      <div className="glass-panel p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Mountain className="w-4 h-4 text-emerald-400" />
            <span>Perfil de Altitud (m) & Pendiente Real (%)</span>
          </h3>
          <span className="text-xs text-dark-muted">Distancia (km) vs Altitud (m)</span>
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
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#232D3F" vertical={false} />
              <XAxis dataKey="distanceKm" stroke="#9CA3AF" tickLine={false} tick={{ fontSize: 11 }} />
              <YAxis stroke="#9CA3AF" tickLine={false} tick={{ fontSize: 11 }} domain={['dataMin - 10', 'dataMax + 10']} />
              <Tooltip
                contentStyle={{ backgroundColor: "#151C28", borderColor: "#232D3F", borderRadius: "12px", color: "#FFF" }}
                formatter={(val: any, name: string) => [
                  name === "altitude" ? `${val} m` : `${val}%`,
                  name === "altitude" ? "Altitud" : "Pendiente"
                ]}
              />
              <Area type="monotone" dataKey="altitude" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#elevGradient)" name="altitude" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Speed & Estimated Power */}
      <div className="glass-panel p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span>Velocidad (km/h) & Potencia Estimada (W)</span>
          </h3>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              onMouseMove={(e) => {
                if (e && e.activePayload && e.activePayload[0] && onPointHover) {
                  onPointHover(e.activePayload[0].payload.index);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#232D3F" vertical={false} />
              <XAxis dataKey="distanceKm" stroke="#9CA3AF" tickLine={false} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" stroke="#06B6D4" tickLine={false} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#F59E0B" tickLine={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#151C28", borderColor: "#232D3F", borderRadius: "12px", color: "#FFF" }} />
              <Line yAxisId="left" type="monotone" dataKey="speed" stroke="#06B6D4" dot={false} strokeWidth={2} name="Velocidad (km/h)" />
              <Line yAxisId="right" type="monotone" dataKey="power" stroke="#F59E0B" dot={false} strokeWidth={2} name="Potencia Est. (W)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Garmin HR Zones Breakdown (Full Width) */}
      <div className="glass-panel p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <HRIcon className="w-4 h-4 text-rose-500" />
            <span>Zonas de Frecuencia Cardíaca Garmin (Edge 130)</span>
          </h3>
          <span className="text-xs text-dark-muted">Distribución del esfuerzo por zonas Z1-Z5</span>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hrZoneBarData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232D3F" horizontal={false} />
              <XAxis type="number" stroke="#9CA3AF" tickLine={false} tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
              <YAxis type="category" dataKey="zone" stroke="#9CA3AF" tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold' }} width={35} />
              <Tooltip
                contentStyle={{ backgroundColor: "#151C28", borderColor: "#232D3F", borderRadius: "12px", color: "#FFF" }}
                formatter={(val: any, _, item: any) => [`${val}% del tiempo`, item.payload.label]}
              />
              <Bar dataKey="pct" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                {hrZoneBarData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Independent Cadence Chart */}
      <div className="glass-panel p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <span>Cadencia de Pedaleo Independiente (rpm)</span>
          </h3>
          <span className="text-xs text-dark-muted">Ritmo de pedaleo en revoluciones por minuto</span>
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
                <linearGradient id="cadGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#232D3F" vertical={false} />
              <XAxis dataKey="distanceKm" stroke="#9CA3AF" tickLine={false} tick={{ fontSize: 11 }} />
              <YAxis stroke="#8B5CF6" domain={[minCad, maxCad]} tickLine={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#151C28", borderColor: "#232D3F", borderRadius: "12px", color: "#FFF" }} />
              <Area type="monotone" dataKey="cadence" stroke="#8B5CF6" strokeWidth={2.5} fillOpacity={1} fill="url(#cadGradient)" name="Cadencia (rpm)" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
