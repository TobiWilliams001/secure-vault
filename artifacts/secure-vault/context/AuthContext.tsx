import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { apiRequest, ApiError } from "@/utils/api";
import { computeAuthKey, generatePbkdf2Salt } from "@/utils/crypto";

export interface AuthUser {
  userId: string;
  email: string;
}

interface AuthState {
  status: "loading" | "unauthenticated" | "authenticated";
  user: AuthUser | null;
  token: string | null;
  pbkdf2Salt: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, masterPassword: string) => Promise<void>;
  register: (email: string, masterPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SK = {
  TOKEN: "sv_token",
  SALT: "sv_pbkdf2_salt",
  USER_ID: "sv_user_id",
  EMAIL: "sv_email",
} as const;

async function readSession(): Promise<AuthState | null> {
  const [token, salt, userId, email] = await Promise.all([
    SecureStore.getItemAsync(SK.TOKEN),
    SecureStore.getItemAsync(SK.SALT),
    SecureStore.getItemAsync(SK.USER_ID),
    SecureStore.getItemAsync(SK.EMAIL),
  ]);
  if (token && salt && userId && email) {
    return {
      status: "authenticated",
      token,
      pbkdf2Salt: salt,
      user: { userId, email },
    };
  }
  return null;
}

async function writeSession(
  token: string,
  salt: string,
  userId: string,
  email: string
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(SK.TOKEN, token),
    SecureStore.setItemAsync(SK.SALT, salt),
    SecureStore.setItemAsync(SK.USER_ID, userId),
    SecureStore.setItemAsync(SK.EMAIL, email),
  ]);
}

async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SK.TOKEN),
    SecureStore.deleteItemAsync(SK.SALT),
    SecureStore.deleteItemAsync(SK.USER_ID),
    SecureStore.deleteItemAsync(SK.EMAIL),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
    token: null,
    pbkdf2Salt: null,
  });

  useEffect(() => {
    void initAuth();
  }, []);

  async function initAuth() {
    try {
      const session = await readSession();
      if (session) {
        try {
          await apiRequest("/auth/me", { token: session.token! });
          setState(session);
          return;
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            await clearSession();
          } else {
            setState(session);
            return;
          }
        }
      }
    } catch {}
    setState({ status: "unauthenticated", user: null, token: null, pbkdf2Salt: null });
  }

  const login = useCallback(async (email: string, masterPassword: string) => {
    const authKey = computeAuthKey(masterPassword, email);
    const data = await apiRequest<{ userId: string; token: string; pbkdf2Salt: string }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email: email.toLowerCase(), authKey }) }
    );
    await writeSession(data.token, data.pbkdf2Salt, data.userId, email.toLowerCase());
    setState({
      status: "authenticated",
      user: { userId: data.userId, email: email.toLowerCase() },
      token: data.token,
      pbkdf2Salt: data.pbkdf2Salt,
    });
  }, []);

  const register = useCallback(async (email: string, masterPassword: string) => {
    const pbkdf2Salt = generatePbkdf2Salt();
    const authKey = computeAuthKey(masterPassword, email);
    const data = await apiRequest<{ userId: string; token: string }>(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify({ email: email.toLowerCase(), authKey, pbkdf2Salt }),
      }
    );
    await writeSession(data.token, pbkdf2Salt, data.userId, email.toLowerCase());
    setState({
      status: "authenticated",
      user: { userId: data.userId, email: email.toLowerCase() },
      token: data.token,
      pbkdf2Salt,
    });
  }, []);

  const logout = useCallback(async () => {
    if (state.token) {
      await apiRequest("/auth/logout", {
        method: "POST",
        token: state.token,
      }).catch(() => {});
    }
    await clearSession();
    await SecureStore.deleteItemAsync("sv_biometric_master").catch(() => {});
    setState({ status: "unauthenticated", user: null, token: null, pbkdf2Salt: null });
  }, [state.token]);

  const deleteAccount = useCallback(async () => {
    if (state.token) {
      await apiRequest("/auth/account", { method: "DELETE", token: state.token });
    }
    await clearSession();
    await SecureStore.deleteItemAsync("sv_biometric_master").catch(() => {});
    setState({ status: "unauthenticated", user: null, token: null, pbkdf2Salt: null });
  }, [state.token]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
