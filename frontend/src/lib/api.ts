import { ActivitySummary, ActivityDetail, AIInsight } from "@/types/telemetry";

const API_BASE = "/api/v1";
const STRAVA_CACHE_KEY = "freeride_strava_activities_v4";

export function purgeLegacyGarminCache() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("freeride_cached_activities");
    localStorage.removeItem("freeride_garmin_auth");
    localStorage.removeItem("freeride_garmin_email");
  } catch {}
}

export function getStravaAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const auth = localStorage.getItem("freeride_strava_auth");
    if (auth) {
      return { "x-strava-auth": auth };
    }
  } catch {}
  return {};
}

export function saveStravaAuthClient(encodedAuth?: string, athleteName?: string) {
  if (typeof window === "undefined") return;
  try {
    purgeLegacyGarminCache();
    if (encodedAuth) {
      localStorage.setItem("freeride_strava_auth", encodedAuth);
    }
    if (athleteName) {
      localStorage.setItem("freeride_strava_athlete", athleteName);
    }
  } catch {}
}

export function clearStravaAuthClient() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("freeride_strava_auth");
    localStorage.removeItem("freeride_strava_athlete");
    localStorage.removeItem(STRAVA_CACHE_KEY);
  } catch {}
}

export async function fetchActivities(): Promise<ActivitySummary[]> {
  purgeLegacyGarminCache();

  try {
    const res = await fetch(`${API_BASE}/activities`, {
      cache: "no-store",
      headers: {
        ...getStravaAuthHeaders()
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(STRAVA_CACHE_KEY, JSON.stringify(data));
          } catch {}
        }
        return data;
      }
    }
  } catch (error) {
    console.error("Error fetching Strava activities:", error);
  }

  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(STRAVA_CACHE_KEY);
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch {}
  }

  return [];
}

export async function fetchActivityDetail(id: string): Promise<ActivityDetail | null> {
  if (typeof window !== "undefined") {
    try {
      const cachedFull = localStorage.getItem(`freeride_strava_detail_${id}`);
      if (cachedFull) {
        const parsed = JSON.parse(cachedFull);
        if (parsed && parsed.id && Array.isArray(parsed.telemetry_points) && parsed.telemetry_points.length > 5) {
          return parsed;
        }
      }
    } catch {}
  }

  try {
    const res = await fetch(`${API_BASE}/activities/${id}`, {
      cache: "no-store",
      headers: {
        ...getStravaAuthHeaders()
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        if (typeof window !== "undefined" && Array.isArray(data.telemetry_points) && data.telemetry_points.length > 0) {
          try {
            localStorage.setItem(`freeride_strava_detail_${id}`, JSON.stringify(data));
          } catch {}
        }
        return data;
      }
    }
  } catch (error) {
    console.error("Error fetching activity detail:", error);
  }

  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(STRAVA_CACHE_KEY);
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          const match = list.find((a: any) => String(a.id) === String(id));
          if (match) return { ...match, telemetry_points: match.telemetry_points || [] };
        }
      }
    } catch {}
  }

  return null;
}

export async function uploadActivityFile(file: File, title?: string, description?: string): Promise<ActivitySummary> {
  const formData = new FormData();
  formData.append("file", file);
  if (title) formData.append("title", title);
  if (description) formData.append("description", description);

  const res = await fetch(`${API_BASE}/activities/upload`, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Error al subir el archivo");
  }

  const created = await res.json();
  if (typeof window !== "undefined" && created && created.id) {
    try {
      localStorage.setItem(`freeride_strava_detail_${created.id}`, JSON.stringify(created));
    } catch {}
  }

  return created;
}

export async function fetchActivityCoachInsight(activityId: string, activityData?: ActivityDetail): Promise<AIInsight> {
  const res = await fetch(`${API_BASE}/coach/analyze/${activityId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getStravaAuthHeaders()
    },
    body: JSON.stringify({ activity: activityData })
  });
  if (!res.ok) {
    throw new Error("Error al generar análisis del entrenador");
  }
  return await res.json();
}

export async function fetchWeeklyPlan(): Promise<AIInsight> {
  const res = await fetch(`${API_BASE}/coach/plan`, {
    cache: "no-store",
    headers: {
      ...getStravaAuthHeaders()
    }
  });
  if (!res.ok) {
    throw new Error("Error al obtener el plan semanal");
  }
  return await res.json();
}

export async function deleteActivity(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/activities/${id}`, {
    method: "DELETE",
    headers: {
      ...getStravaAuthHeaders()
    }
  });

  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(`freeride_strava_detail_${id}`);
      const cached = localStorage.getItem(STRAVA_CACHE_KEY);
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          const filtered = list.filter((a: any) => String(a.id) !== String(id));
          localStorage.setItem(STRAVA_CACHE_KEY, JSON.stringify(filtered));
        }
      }
    } catch {}
  }

  return res.ok;
}
