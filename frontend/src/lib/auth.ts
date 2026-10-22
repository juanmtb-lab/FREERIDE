import { UserProfile } from "@/types/auth";

const CURRENT_USER_KEY = "freeride_current_user_id";
const USERS_REGISTRY_KEY = "freeride_users_registry";
const LOGGED_OUT_KEY = "freeride_logged_out";

export function getAllUsers(): UserProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_REGISTRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getCurrentUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    if (localStorage.getItem(LOGGED_OUT_KEY) === "true") {
      return null;
    }
    const currentId = localStorage.getItem(CURRENT_USER_KEY);
    if (!currentId) return null;
    const users = getAllUsers();
    return users.find((u) => u.id === currentId) || null;
  } catch {
    return null;
  }
}

export function saveUser(user: UserProfile) {
  if (typeof window === "undefined") return;
  try {
    const users = getAllUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx !== -1) {
      users[idx] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(users));
  } catch (e) {
    console.error("Error saving user:", e);
  }
}

export function setCurrentUser(user: UserProfile | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, user.id);
      localStorage.removeItem(LOGGED_OUT_KEY);
      saveUser(user);
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
      localStorage.setItem(LOGGED_OUT_KEY, "true");
    }
    window.dispatchEvent(new Event("auth-changed"));
  } catch (e) {
    console.error("Error setting current user:", e);
  }
}

export function registerUser(name: string, email: string): UserProfile {
  const users = getAllUsers();
  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    setCurrentUser(existing);
    return existing;
  }

  const cleanName = name.trim();
  const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const newUser: UserProfile = {
    id: `usr_${slug || Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: cleanName,
    email: email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
    onboardingCompleted: false
  };

  setCurrentUser(newUser);
  return newUser;
}

export function loginUser(email: string): UserProfile | null {
  const users = getAllUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (user) {
    setCurrentUser(user);
    return user;
  }
  return null;
}

export function logoutUser() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.setItem(LOGGED_OUT_KEY, "true");
  window.dispatchEvent(new Event("auth-changed"));
}

export function deleteUser(userId: string) {
  if (typeof window === "undefined") return;
  try {
    const users = getAllUsers().filter((u) => u.id !== userId);
    localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(users));
    if (localStorage.getItem(CURRENT_USER_KEY) === userId) {
      logoutUser();
    } else {
      window.dispatchEvent(new Event("auth-changed"));
    }
  } catch (e) {
    console.error("Error deleting user:", e);
  }
}

export function ensureInitialMigration(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const isExplicitlyLoggedOut = localStorage.getItem(LOGGED_OUT_KEY) === "true";
    let users = getAllUsers();

    if (users.length === 0) {
      const cachedAthlete = localStorage.getItem("freeride_strava_athlete") || "JM TB";
      const cachedAuth = localStorage.getItem("freeride_strava_auth");
      const ownerUser: UserProfile = {
        id: "usr_jmtb",
        name: cachedAthlete,
        email: "jmtb@freeride.app",
        createdAt: new Date().toISOString(),
        onboardingCompleted: true,
        stravaAuth: cachedAuth || undefined,
        stravaAthleteName: cachedAthlete
      };
      users = [ownerUser];
      localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(users));

      const oldActs = localStorage.getItem("freeride_strava_activities_v4");
      if (oldActs) {
        localStorage.setItem("freeride_strava_activities_usr_jmtb", oldActs);
      }

      if (!isExplicitlyLoggedOut) {
        localStorage.setItem(CURRENT_USER_KEY, "usr_jmtb");
        return ownerUser;
      }
      return null;
    }

    if (isExplicitlyLoggedOut) {
      return null;
    }

    const currentId = localStorage.getItem(CURRENT_USER_KEY);
    if (currentId) {
      return users.find((u) => u.id === currentId) || null;
    }

    // Default to first user if never logged out
    const first = users[0];
    localStorage.setItem(CURRENT_USER_KEY, first.id);
    return first;
  } catch {
    return null;
  }
}

// User-scoped LocalStorage helpers to avoid data leak between friends
export function getUserStorageKey(baseKey: string, userId?: string): string {
  const activeId = userId || getCurrentUser()?.id || "anonymous";
  return `${baseKey}_${activeId}`;
}
