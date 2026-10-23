import { ActivitySummary, ActivityDetail, AIInsight } from "@/types/telemetry";
import { getCurrentUser, getUserStorageKey, saveUser } from "./auth";

const API_BASE = "/api/v1";

export function getStravaCacheKey(): string {
  const user = getCurrentUser();
  return user ? `freeride_strava_activities_${user.id}` : "freeride_strava_activities_guest";
}

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
    const user = getCurrentUser();
    const isOwner = !user || user.id === "principal" || user.id === "usr_jmtb" || user.email === "jmtb@freeride.app" || user.email === "principal@freeride.app";
    const auth =
      user?.stravaAuth ||
      localStorage.getItem(getUserStorageKey("freeride_strava_auth")) ||
      (isOwner ? localStorage.getItem("freeride_strava_auth") : null);
    
    const n8nWebhook = localStorage.getItem("freeride_n8n_webhook");

    return { 
      ...(auth ? { "x-strava-auth": auth } : {}),
      ...(user?.id ? { "x-user-id": user.id } : {}),
      ...(n8nWebhook ? { "x-n8n-webhook-url": n8nWebhook } : {})
    };
  } catch {}
  return {};
}

export function saveStravaAuthClient(encodedAuth?: string, athleteName?: string) {
  if (typeof window === "undefined") return;
  try {
    purgeLegacyGarminCache();
    const user = getCurrentUser();
    const isOwner = !user || user.id === "principal" || user.id === "usr_jmtb" || user.email === "jmtb@freeride.app";

    if (encodedAuth) {
      localStorage.setItem(getUserStorageKey("freeride_strava_auth"), encodedAuth);
      if (isOwner) {
        localStorage.setItem("freeride_strava_auth", encodedAuth);
      }
    }
    if (athleteName) {
      localStorage.setItem(getUserStorageKey("freeride_strava_athlete"), athleteName);
      if (isOwner) {
        localStorage.setItem("freeride_strava_athlete", athleteName);
      }
    }
    if (user) {
      user.stravaAuth = encodedAuth || user.stravaAuth;
      user.stravaAthleteName = athleteName || user.stravaAthleteName;
      saveUser(user);
    }
    window.dispatchEvent(new Event("strava-synced"));
  } catch {}
}

export function clearStravaAuthClient() {
  if (typeof window === "undefined") return;
  try {
    const user = getCurrentUser();
    const isOwner = !user || user.id === "principal" || user.id === "usr_jmtb" || user.email === "jmtb@freeride.app";

    localStorage.removeItem(getUserStorageKey("freeride_strava_auth"));
    localStorage.removeItem(getUserStorageKey("freeride_strava_athlete"));
    localStorage.removeItem(getStravaCacheKey());

    if (isOwner) {
      localStorage.removeItem("freeride_strava_auth");
      localStorage.removeItem("freeride_strava_athlete");
    }

    if (user) {
      delete user.stravaAuth;
      delete user.stravaAthleteName;
      delete user.stravaAthleteId;
      saveUser(user);
    }
    window.dispatchEvent(new Event("strava-synced"));
  } catch {}
}

export async function fetchActivities(): Promise<ActivitySummary[]> {
  purgeLegacyGarminCache();
  const user = getCurrentUser();
  if (!user) return [];

  const cacheKey = getStravaCacheKey();
  const isOwner = user.id === "principal" || user.id === "usr_jmtb" || user.email === "jmtb@freeride.app";

  try {
    const res = await fetch(`${API_BASE}/activities`, {
      cache: "no-store",
      headers: {
        ...getStravaAuthHeaders()
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
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
      const cached =
        localStorage.getItem(cacheKey) ||
        (isOwner ? localStorage.getItem("freeride_strava_activities_v4") : null);
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) return list;
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
      const user = getCurrentUser();
      const isOwner = !user || user.id === "principal" || user.email === "principal@freeride.app";
      const cached =
        localStorage.getItem(getStravaCacheKey()) ||
        (isOwner ? localStorage.getItem("freeride_strava_activities_v4") : null);
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
  const user = getCurrentUser();
  const n8nWebhook = typeof window !== "undefined"
    ? localStorage.getItem("freeride_n8n_webhook") || user?.n8nWebhookUrl
    : undefined;

  const res = await fetch(`${API_BASE}/coach/analyze/${activityId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getStravaAuthHeaders(),
      ...(n8nWebhook ? { "x-n8n-webhook-url": n8nWebhook } : {})
    },
    body: JSON.stringify({
      activity: activityData,
      webhook_url: n8nWebhook || undefined,
      athlete_profile: user ? {
        name: user.name,
        age: user.age,
        weight_kg: user.weightKg,
        height_cm: user.heightCm,
        experience_level: user.experienceLevel,
        weekly_days_target: user.weeklyDaysTarget,
        weekly_hours_target: user.weeklyHoursTarget,
        max_hr_bpm: user.knownMaxHr,
        known_ftp_watts: user.knownFtp
      } : undefined
    })
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
      const key = getStravaCacheKey();
      const cached = localStorage.getItem(key);
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          const filtered = list.filter((a: any) => String(a.id) !== String(id));
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      }
    } catch {}
  }

  return res.ok;
}
