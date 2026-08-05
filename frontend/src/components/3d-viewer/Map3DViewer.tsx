"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { TelemetryPoint } from "@/types/telemetry";
import { Play, Pause, RotateCcw, Mountain, Activity as HRIcon, Zap, Gauge, Camera, Eye } from "lucide-react";
import { formatSpeed, formatElevation, formatWatts } from "@/lib/utils";

interface Map3DViewerProps {
  points: TelemetryPoint[];
  activeIndex?: number;
  onPointSelect?: (index: number) => void;
}

export default function Map3DViewer({ points, activeIndex = 0, onPointSelect }: Map3DViewerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const markerEl = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [cameraMode, setCameraMode] = useState<'FOLLOW' | 'OVERVIEW'>('FOLLOW');
  const [currentIndex, setCurrentIndex] = useState(activeIndex);

  useEffect(() => {
    setCurrentIndex(activeIndex);
  }, [activeIndex]);

  useEffect(() => {
    if (!mapContainer.current || points.length === 0) return;

    const coordinates: [number, number, number][] = points.map(p => [
      p.longitude,
      p.latitude,
      p.altitude_m
    ]);

    const centerLat = points[Math.floor(points.length / 2)].latitude;
    const centerLon = points[Math.floor(points.length / 2)].longitude;

    // Initialize MapLibre with smooth 3D terrain pitch
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; CartoDB &copy; OpenStreetMap'
          },
          'terrain-dem': {
            type: 'raster-dem',
            tiles: [
              'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
            ],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15
          }
        },
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 22
          }
        ],
        terrain: {
          source: 'terrain-dem',
          exaggeration: 2.8
        }
      },
      center: [centerLon, centerLat],
      zoom: 14.2,
      pitch: 65,
      bearing: -15
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      if (!map.current) return;

      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coordinates.map(c => [c[0], c[1]])
          }
        }
      });

      map.current.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#FF5722',
          'line-width': 8,
          'line-opacity': 0.45
        }
      });

      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#FFA726',
          'line-width': 3.5
        }
      });

      // Minimalist Bike Marker Element (Center Anchored)
      const el = document.createElement('div');
      el.className = 'w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 border-2 border-white shadow-xl shadow-orange-500/70 flex items-center justify-center pointer-events-none';
      el.style.transformOrigin = 'center center';
      el.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18.5" cy="17.5" r="3.5"/>
          <circle cx="5.5" cy="17.5" r="3.5"/>
          <circle cx="15" cy="5" r="1"/>
          <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
        </svg>
      `;
      markerEl.current = el;

      marker.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([points[0].longitude, points[0].latitude])
        .addTo(map.current);
    });

    return () => {
      map.current?.remove();
    };
  }, [points]);

  // Smooth Marker & Camera Follow Handling
  useEffect(() => {
    if (!points[currentIndex] || !marker.current || !map.current) return;

    const p = points[currentIndex];
    marker.current.setLngLat([p.longitude, p.latitude]);

    let headingDeg = 0;
    if (currentIndex < points.length - 1) {
      const nextP = points[currentIndex + 1];
      const dLon = nextP.longitude - p.longitude;
      const dLat = nextP.latitude - p.latitude;
      headingDeg = (Math.atan2(dLon, dLat) * 180) / Math.PI;
      if (markerEl.current) {
        markerEl.current.style.transform = `rotate(${headingDeg}deg)`;
      }
    }

    if (isPlaying && cameraMode === 'FOLLOW') {
      map.current.easeTo({
        center: [p.longitude, p.latitude],
        zoom: 15.2,
        pitch: 68,
        bearing: headingDeg,
        duration: 120,
        easing: t => t
      });
    }
  }, [currentIndex, points, isPlaying, cameraMode]);

  // Smooth Playback Loop: Max 35 Seconds Total Animation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      const targetDurationMs = 35000;
      const stepIntervalMs = 80;
      const totalSteps = targetDurationMs / stepIntervalMs;
      const stepSize = Math.max(1, Math.ceil(points.length / totalSteps));

      interval = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= points.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = Math.min(points.length - 1, prev + stepSize);
          if (onPointSelect) onPointSelect(next);
          return next;
        });
      }, stepIntervalMs);
    }
    return () => clearInterval(interval);
  }, [isPlaying, points.length, onPointSelect]);

  const currentPt = points[currentIndex] || points[0];

  return (
    <div className="relative w-full h-[380px] sm:h-[560px] rounded-2xl overflow-hidden border border-dark-border bg-dark-bg shadow-2xl">
      {/* Map Canvas */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Real-time Telemetry HUD (Responsive Top Floating Glass Card) */}
      <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-auto glass-panel p-2.5 sm:p-4 rounded-xl flex flex-wrap items-center justify-between gap-2 sm:gap-4 z-10 text-xs sm:text-sm">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
            <Gauge className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <p className="text-[10px] sm:text-[11px] text-dark-muted font-medium">Velocidad</p>
            <p className="text-xs sm:text-base font-bold text-white">{formatSpeed(currentPt?.speed_kmh || 0)}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Mountain className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <p className="text-[10px] sm:text-[11px] text-dark-muted font-medium">Pendiente / Altitud</p>
            <p className="text-xs sm:text-base font-bold text-white">
              <span className={currentPt?.gradient_pct >= 0 ? "text-emerald-400" : "text-cyan-400"}>
                {currentPt?.gradient_pct > 0 ? `+${currentPt.gradient_pct}` : currentPt?.gradient_pct || 0}%
              </span>
              {" | "}
              {formatElevation(currentPt?.altitude_m || 0)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <HRIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <p className="text-[10px] sm:text-[11px] text-dark-muted font-medium">Frecuencia</p>
            <p className="text-xs sm:text-base font-bold text-white">
              {currentPt?.heart_rate ? `${currentPt.heart_rate} bpm` : "-- bpm"}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <p className="text-[10px] sm:text-[11px] text-dark-muted font-medium">Potencia</p>
            <p className="text-xs sm:text-base font-bold text-white">{formatWatts(currentPt?.estimated_power_w || 0)}</p>
          </div>
        </div>
      </div>

      {/* Playback Controls (Responsive Bottom Floating Bar) */}
      <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 glass-panel p-2.5 sm:p-3 rounded-xl flex items-center justify-between gap-2 sm:gap-4 z-10">
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-dark-accent text-white flex items-center justify-center hover:bg-orange-600 transition shadow-md shadow-orange-500/30"
          >
            {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />}
          </button>

          <button
            onClick={() => {
              setCurrentIndex(0);
              setIsPlaying(false);
              if (onPointSelect) onPointSelect(0);
            }}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-dark-border text-dark-muted hover:text-white flex items-center justify-center transition"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={() => setCameraMode(prev => prev === 'FOLLOW' ? 'OVERVIEW' : 'FOLLOW')}
            className={`px-2.5 sm:px-3.5 h-8 sm:h-10 rounded-lg text-[11px] sm:text-xs font-bold flex items-center space-x-1 transition ${
              cameraMode === 'FOLLOW'
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                : "bg-dark-border text-dark-muted hover:text-white"
            }`}
          >
            {cameraMode === 'FOLLOW' ? <Camera className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{cameraMode === 'FOLLOW' ? "Seguimiento 3D" : "Vista Global"}</span>
            <span className="sm:hidden">{cameraMode === 'FOLLOW' ? "3D" : "Map"}</span>
          </button>
        </div>

        {/* Timeline Scrub Slider */}
        <div className="flex-1 flex items-center space-x-2 sm:space-x-3">
          <input
            type="range"
            min={0}
            max={points.length - 1}
            value={currentIndex}
            onChange={(e) => {
              const idx = parseInt(e.target.value);
              setCurrentIndex(idx);
              if (onPointSelect) onPointSelect(idx);
            }}
            className="w-full accent-orange-500 cursor-pointer h-1.5 sm:h-2 bg-dark-border rounded-lg"
          />
          <span className="text-[11px] sm:text-xs text-dark-muted font-mono whitespace-nowrap">
            {Math.floor((currentPt?.elapsed_time_sec || 0) / 60)} m
          </span>
        </div>
      </div>
    </div>
  );
}
