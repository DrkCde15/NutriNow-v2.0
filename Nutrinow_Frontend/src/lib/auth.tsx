import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRequest } from "@/lib/api";

export interface User {
  id: string;
  nome: string;
  email: string;
  avatar?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  updateUser: (patch: Partial<Omit<User, "id">>) => void;
  logout: () => Promise<void>;
}

export interface RegisterPayload {
  nome: string;
  sobrenome: string;
  data_nascimento: string;
  genero: "Masculino" | "Feminino";
  email: string;
  senha: string;
  meta: string;
  altura?: number;
  peso?: number;
  ja_treinou: string;
}

interface StoredSession {
  token: string;
  user: User;
}

interface LoginResponse {
  access_token: string;
  user: { id: number | string; nome: string; email: string };
}

interface MeResponse {
  id: number | string;
  nome: string;
  email: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AUTH_STORAGE_KEY = "nutrinow_auth_session";
export const CHAT_SESSION_STORAGE_KEY = "nutrinow_chat_session_id";

function normalizeUser(input: { id: number | string; nome: string; email: string; avatar?: string }): User {
  return {
    id: String(input.id),
    nome: input.nome,
    email: input.email,
    avatar: input.avatar,
  };
}

export function getStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const persist = (next: StoredSession | null) => {
    if (next) {
      setUser(next.user);
      setToken(next.token);
    } else {
      setUser(null);
      setToken(null);
    }

    if (typeof window === "undefined") return;
    if (next) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
      return;
    }
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
  };

  useEffect(() => {
    const hydrate = async () => {
      const session = getStoredSession();
      if (!session) {
        setLoading(false);
        return;
      }

      try {
        const me = await apiRequest<MeResponse>("/me", { method: "GET", token: session.token });
        persist({
          token: session.token,
          user: normalizeUser({ ...me, avatar: session.user.avatar }),
        });
      } catch {
        persist(null);
      } finally {
        setLoading(false);
      }
    };

    hydrate();
  }, []);

  const login = async (email: string, senha: string) => {
    if (!email || !senha) throw new Error("Preencha email e senha");
    const response = await apiRequest<LoginResponse>("/login", {
      method: "POST",
      body: JSON.stringify({ email, senha }),
    });

    persist({
      token: response.access_token,
      user: normalizeUser(response.user),
    });
  };

  const register = async (payload: RegisterPayload) => {
    if (!payload.nome || !payload.sobrenome || !payload.data_nascimento || !payload.genero || !payload.email || !payload.senha) {
      throw new Error("Preencha todos os campos obrigatorios");
    }
    if (payload.senha.length < 6) throw new Error("Senha deve ter ao menos 6 caracteres");

    await apiRequest<{ message: string }>("/cadastro", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    await login(payload.email, payload.senha);
  };

  const updateUser = (patch: Partial<Omit<User, "id">>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };

      if (typeof window !== "undefined" && token) {
        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({
            token,
            user: next,
          } satisfies StoredSession),
        );
      }

      return next;
    });
  };

  const logout = async () => {
    const currentToken = token;
    persist(null);
    if (!currentToken) return;

    try {
      await apiRequest<{ message: string }>("/logout", {
        method: "POST",
        token: currentToken,
      });
    } catch {
      // ignore logout errors because local session was already cleared
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
