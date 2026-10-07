import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as api from './api.js';
import { can as canDo } from './roles.js';

const AuthContext = createContext(null);
const KEY = 'sentinel-session';

const load = () => {
  try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; }
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(load);

  const save = (data) => {
    sessionStorage.setItem(KEY, JSON.stringify(data));
    setSession(data);
  };

  const logout = useCallback(() => {
    sessionStorage.removeItem(KEY);
    setSession(null);
  }, []);

  const login = async (username, password) => save((await api.login(username, password)).data);
  const faceLogin = async (username) => save((await api.faceLogin(username)).data);

  // Tout 401 sur une route authentifiée (jeton expiré, compte supprimé) déconnecte
  useEffect(() => api.setUnauthorizedHandler(logout), [logout]);

  // Rôle relu au chargement : un changement de rôle fait par un admin est pris en compte
  const token = session?.token;
  useEffect(() => {
    if (!token) return;
    api.getMe(token)
      .then(({ data }) => setSession((prev) => {
        if (!prev || prev.token !== token) return prev;
        const next = { ...prev, user: data };
        sessionStorage.setItem(KEY, JSON.stringify(next));
        return next;
      }))
      .catch(() => {});
  }, [token]);

  const user = session?.user;
  return (
    <AuthContext.Provider value={{ token, user, login, faceLogin, logout, can: (permission) => canDo(user, permission) }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
