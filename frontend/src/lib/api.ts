import { ActivitySummary, ActivityDetail, AIInsight } from "@/types/telemetry";

const API_BASE = "/api/v1";

export function getGarminAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const auth = localStorage.getItem("freeride_garmin_auth");
    if (auth) {
      return { "x-garmin-auth": auth };
    }
  } catch {}
  return {};
}

export function saveGarminAuthClient(encodedAuth?: string, email?: string) {
  if (typeof window === "undefined") return;
  try {
    if (encodedAuth) {
      localStorage.setItem("freeride_garmin_auth", encodedAuth);
    }
    if (email) {
      localStorage.setItem("freeride_garmin_email", email);
    }
  } catch {}
}

export function clearGarminAuthClient() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("freeride_garmin_auth");
    localStorage.removeItem("freeride_garmin_email");
  } catch {}
}

export async function fetchActivities(): Promise<ActivitySummary[]> {
  try {
    const res = await fetch(`${API_BASE}/activities`, {
      cache: "no-store",
      headers: {
        ...getGarminAuthHeaders()
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("freeride_cached_activities", JSON.stringify(data));
          } catch {}
        }
        return data;
      }
    }
  } catch (error) {
    console.error("Error fetching activities:", error);
  }

  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("freeride_cached_activities");
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch {}
  }

  return [];
}

export async function fetchActivityDetail(id: string): Promise<ActivityDetail | null> {
  // 1. Check if we already cached the full activity with real telemetry points locally
  if (typeof window !== "undefined") {
    try {
      const cachedFull = localStorage.getItem(`freeride_activity_detail_${id}`);
      if (cachedFull) {
        const parsed = JSON.parse(cachedFull);
        if (parsed && parsed.id && Array.isArray(parsed.telemetry_points) && parsed.telemetry_points.length > 5) {
          return parsed;
        }
      }
    } catch {}
  }

  // 2. Fetch from server (which downloads real Garmin telemetry points & HR zones on demand)
  try {
    const res = await fetch(`${API_BASE}/activities/${id}`, {
      cache: "no-store",
      headers: {
        ...getGarminAuthHeaders()
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        if (typeof window !== "undefined" && Array.isArray(data.telemetry_points) && data.telemetry_points.length > 0) {
          try {
            localStorage.setItem(`freeride_activity_detail_${id}`, JSON.stringify(data));
          } catch {}
        }
        return data;
      }
    }
  } catch (error) {
    console.error("Error fetching activity detail:", error);
  }

  // 3. Fallback to summary list if offline
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("freeride_cached_activities");
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
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Error al subir el archivo");
  }

  const created = await res.json();
  if (typeof window !== "undefined" && created && created.id) {
    try {
      localStorage.setItem(`freeride_activity_detail_${created.id}`, JSON.stringify(created));
    } catch {}
  }

  return created;
}

export async function fetchActivityCoachInsight(activityId: string, activityData?: ActivityDetail): Promise<AIInsight> {
  const res = await fetch(`${API_BASE}/coach/analyze/${activityId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getGarminAuthHeaders()
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
      ...getGarminAuthHeaders()
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
      ...getGarminAuthHeaders()
    }
  });

  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(`freeride_activity_detail_${id}`);
      const cached = localStorage.getItem("freeride_cached_activities");
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          const filtered = list.filter((a: any) => String(a.id) !== String(id));
          localStorage.setItem("freeride_cached_activities", JSON.stringify(filtered));
        }
      }
    } catch {}
  }

  return res.ok;
}
