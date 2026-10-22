"use client";

import { useState } from "react";
import { UserProfile } from "@/types/auth";
import { getAllUsers, loginUser, registerUser, logoutUser, deleteUser } from "@/lib/auth";
import { User, UserPlus, LogIn, LogOut, Check, ChevronDown, X, Trash2 } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onUserChanged: (user: UserProfile | null) => void;
}

export default function AuthModal({ isOpen, onClose, currentUser, onUserChanged }: AuthModalProps) {
  const [tab, setTab] = useState<"switch" | "register">("switch");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const users = getAllUsers();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Por favor introduce un nombre y un correo electrónico");
      return;
    }
    const user = registerUser(name, email);
    onUserChanged(user);
    onClose();
  };

  const handleSelectUser = (u: UserProfile) => {
    loginUser(u.email);
    onUserChanged(u);
    onClose();
  };

  const handleLogout = () => {
    logoutUser();
    onUserChanged(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-5 relative shadow-2xl animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-dark-muted hover:text-white p-1.5 rounded-xl transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Perfiles de Usuario</h2>
            <p className="text-xs text-dark-muted">Acceso multicuenta independiente con datos aislados</p>
          </div>
        </div>

        {/* Pestañas: Cambiar Usuario vs Crear Cuenta */}
        <div className="flex rounded-xl bg-dark-bg p-1 border border-dark-border text-xs">
          <button
            type="button"
            onClick={() => { setTab("switch"); setError(null); }}
            className={`flex-1 py-2 rounded-lg font-bold transition flex items-center justify-center space-x-1.5 ${
              tab === "switch" ? "bg-orange-600 text-white shadow-md shadow-orange-600/30" : "text-dark-muted hover:text-white"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Mis Perfiles ({users.length})</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab("register"); setError(null); }}
            className={`flex-1 py-2 rounded-lg font-bold transition flex items-center justify-center space-x-1.5 ${
              tab === "register" ? "bg-orange-600 text-white shadow-md shadow-orange-600/30" : "text-dark-muted hover:text-white"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Nuevo Atleta / Amigo</span>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {tab === "switch" ? (
          <div className="space-y-3">
            {users.length === 0 ? (
              <div className="p-6 text-center text-dark-muted text-xs space-y-3 bg-dark-bg/60 rounded-2xl border border-dark-border">
                <p>Todavía no hay perfiles registrados.</p>
                <button
                  onClick={() => setTab("register")}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl transition"
                >
                  Crear mi primer usuario
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {users.map((u) => {
                  const isActive = currentUser?.id === u.id;
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                        isActive
                          ? "bg-orange-500/15 border-orange-500/50 text-white"
                          : "bg-dark-bg/60 border-dark-border text-dark-muted hover:text-white hover:border-dark-muted/50"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <p className="text-xs font-bold text-white">{u.name}</p>
                          {isActive && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-orange-500 text-white">
                              Activo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-dark-muted">{u.email}</p>
                        {u.stravaAthleteName && (
                          <p className="text-[10px] text-orange-400 font-semibold flex items-center space-x-1">
                            <span>Strava: {u.stravaAthleteName}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {isActive ? (
                          <Check className="w-5 h-5 text-orange-400 shrink-0" />
                        ) : (
                          <span className="text-[11px] font-bold text-orange-400 hover:underline">
                            Cambiar
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`¿Eliminar el perfil de ${u.name}?`)) {
                              deleteUser(u.id);
                              if (currentUser?.id === u.id) {
                                onUserChanged(null);
                              }
                            }
                          }}
                          className="p-1 text-dark-muted hover:text-rose-400 transition"
                          title="Eliminar perfil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {currentUser && (
              <div className="pt-2 border-t border-dark-border flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs text-rose-400 hover:text-rose-300 transition flex items-center space-x-1 font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar sesión de {currentUser.name}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-dark-muted mb-1">
                Nombre de usuario o alias
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Carlos Gómez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-dark-muted mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                placeholder="carlos@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
              />
              <p className="text-[10px] text-dark-muted mt-1">
                Servirá para identificar su cuenta y guardar sus rutas y cuestionario por separado.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition shadow-lg shadow-orange-600/30 flex items-center justify-center space-x-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Crear Cuenta y Rellenar Cuestionario</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
