import { ActivitySummary, ActivityDetail, AIInsight } from "@/types/telemetry";

const API_BASE = "/api/v1";

export async function fetchActivities(): Promise<ActivitySummary[]> {
  try {
    const res = await fetch(`${API_BASE}/activities`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
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
  try {
    const res = await fetch(`${API_BASE}/activities/${id}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) return data;
    }
  } catch (error) {
    console.error("Error fetching activity detail:", error);
  }

  // Client-side localStorage fallback guarantee
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("freeride_cached_activities");
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          const match = list.find((a: any) => String(a.id) === String(id) || String(a.strava_id) === String(id));
          if (match) return match;
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

  return await res.json();
}

export async function fetchActivityCoachInsight(activityId: string): Promise<AIInsight> {
  const res = await fetch(`${API_BASE}/coach/analyze/${activityId}`, {
    method: "POST"
  });
  if (!res.ok) {
    throw new Error("Error al generar análisis del entrenador");
  }
  return await res.json();
}

export async function fetchWeeklyPlan(): Promise<AIInsight> {
  const res = await fetch(`${API_BASE}/coach/plan`);
  if (!res.ok) {
    throw new Error("Error al obtener el plan semanal");
  }
  return await res.json();
}

export async function deleteActivity(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/activities/${id}`, {
    method: "DELETE"
  });

  if (typeof window !== "undefined") {
    try {
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
