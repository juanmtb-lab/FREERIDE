import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

export function formatDistance(meters: number): string {
  return (meters / 1000).toFixed(1) + " km";
}

export function formatElevation(meters: number): string {
  return Math.round(meters) + " m";
}

export function formatSpeed(kmh: number): string {
  return kmh.toFixed(1) + " km/h";
}

export function formatWatts(w: number): string {
  return Math.round(w) + " W";
}

export function decodePolyline(encoded: string): [number, number][] {
  if (!encoded) return [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  const coordinates: [number, number][] = [];

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    coordinates.push([lng * 1e-5, lat * 1e-5]); // MapLibre takes [lon, lat]
  }

  return coordinates;
}
