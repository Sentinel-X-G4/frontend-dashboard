import { createContext, useContext, useState } from 'react';
import * as api from './api.js';

const AuthContext = createContext(null);
const KEY = 'sentinel-session';

const load = () => {
  try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; }
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(load);

  const login = async (username, password) => {
    const { data } = await api.login(username, password);
    sessionStorage.setItem(KEY, JSON.stringify(data));
    setSession(data);
  };

  const logout = () => {
    sessionStorage.removeItem(KEY);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ token: session?.token, user: session?.user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
