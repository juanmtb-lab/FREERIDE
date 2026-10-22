import { UserProfile } from "@/types/auth";

const CURRENT_USER_KEY = "freeride_current_user_id";
const USERS_REGISTRY_KEY = "freeride_users_registry";

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
      saveUser(user);
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
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

  const newUser: UserProfile = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim(),
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
  setCurrentUser(null);
}

// User-scoped LocalStorage helpers to avoid data leak between friends
export function getUserStorageKey(baseKey: string, userId?: string): string {
  const activeId = userId || getCurrentUser()?.id || "default";
  return `${baseKey}_${activeId}`;
}
