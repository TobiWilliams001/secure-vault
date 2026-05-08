import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/utils/api";
import {
  decryptData,
  deriveEncryptionKey,
  encryptData,
  generateId,
} from "@/utils/crypto";

export type SecretCategory = "password" | "seed" | "note" | "card";

export interface SecretField {
  label: string;
  value: string;
  sensitive: boolean;
}

export interface VaultSecret {
  id: string;
  title: string;
  category: SecretCategory;
  fields: SecretField[];
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
}

type VaultStatus = "locked" | "unlocked";

interface VaultContextType {
  vaultStatus: VaultStatus;
  secrets: VaultSecret[];
  unlock: (masterPassword: string) => Promise<boolean>;
  lock: () => void;
  addSecret: (s: Omit<VaultSecret, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateSecret: (
    id: string,
    updates: Partial<Omit<VaultSecret, "id" | "createdAt">>
  ) => Promise<void>;
  deleteSecret: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  isSyncing: boolean;
}

const VaultContext = createContext<VaultContextType | null>(null);

const cacheKey = (userId: string) => `sv_vault_cache_${userId}`;

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { token, pbkdf2Salt, user } = useAuth();
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>("locked");
  const [secrets, setSecrets] = useState<VaultSecret[]>([]);
  const [encryptionKey, setEncryptionKey] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!token) {
      setVaultStatus("locked");
      setSecrets([]);
      setEncryptionKey("");
    }
  }, [token]);

  const unlock = useCallback(
    async (masterPassword: string): Promise<boolean> => {
      if (!pbkdf2Salt || !token || !user) return false;
      try {
        const key = deriveEncryptionKey(masterPassword, pbkdf2Salt);

        const serverData = await apiRequest<{
          encryptedData: string | null;
          updatedAt: string | null;
        }>("/vault", { token });

        let loaded: VaultSecret[] = [];

        if (serverData.encryptedData) {
          const decrypted = await decryptData(serverData.encryptedData, key);
          loaded = JSON.parse(decrypted) as VaultSecret[];
          await AsyncStorage.setItem(cacheKey(user.userId), serverData.encryptedData);
        } else {
          const cached = await AsyncStorage.getItem(cacheKey(user.userId));
          if (cached) {
            try {
              const decrypted = await decryptData(cached, key);
              loaded = JSON.parse(decrypted) as VaultSecret[];
            } catch {
              loaded = [];
            }
          }
        }

        setEncryptionKey(key);
        setSecrets(loaded);
        setVaultStatus("unlocked");

        const bioEnabled = await SecureStore.getItemAsync("sv_biometric_enabled");
        if (bioEnabled === "true") {
          await SecureStore.setItemAsync("sv_biometric_master", masterPassword);
        }

        return true;
      } catch {
        return false;
      }
    },
    [pbkdf2Salt, token, user]
  );

  const lock = useCallback(() => {
    setVaultStatus("locked");
    setSecrets([]);
    setEncryptionKey("");
  }, []);

  const syncToServer = useCallback(
    async (updated: VaultSecret[], key: string, tok: string, uid: string) => {
      setIsSyncing(true);
      try {
        const encrypted = await encryptData(JSON.stringify(updated), key);
        await apiRequest("/vault", {
          method: "PUT",
          token: tok,
          body: JSON.stringify({ encryptedData: encrypted }),
        });
        await AsyncStorage.setItem(cacheKey(uid), encrypted);
      } finally {
        setIsSyncing(false);
      }
    },
    []
  );

  const addSecret = useCallback(
    async (secretData: Omit<VaultSecret, "id" | "createdAt" | "updatedAt">) => {
      if (!token || !user) return;
      const newSecret: VaultSecret = {
        ...secretData,
        id: generateId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const updated = [...secrets, newSecret];
      setSecrets(updated);
      await syncToServer(updated, encryptionKey, token, user.userId);
    },
    [secrets, encryptionKey, token, user, syncToServer]
  );

  const updateSecret = useCallback(
    async (id: string, updates: Partial<Omit<VaultSecret, "id" | "createdAt">>) => {
      if (!token || !user) return;
      const updated = secrets.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
      );
      setSecrets(updated);
      await syncToServer(updated, encryptionKey, token, user.userId);
    },
    [secrets, encryptionKey, token, user, syncToServer]
  );

  const deleteSecret = useCallback(
    async (id: string) => {
      if (!token || !user) return;
      const updated = secrets.filter((s) => s.id !== id);
      setSecrets(updated);
      await syncToServer(updated, encryptionKey, token, user.userId);
    },
    [secrets, encryptionKey, token, user, syncToServer]
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      if (!token || !user) return;
      const updated = secrets.map((s) =>
        s.id === id ? { ...s, favorite: !s.favorite, updatedAt: Date.now() } : s
      );
      setSecrets(updated);
      await syncToServer(updated, encryptionKey, token, user.userId);
    },
    [secrets, encryptionKey, token, user, syncToServer]
  );

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string): Promise<boolean> => {
      if (!pbkdf2Salt || !token || !user) return false;
      try {
        const oldKey = deriveEncryptionKey(oldPassword, pbkdf2Salt);
        if (oldKey !== encryptionKey) return false;
        const newKey = deriveEncryptionKey(newPassword, pbkdf2Salt);
        setEncryptionKey(newKey);
        await syncToServer(secrets, newKey, token, user.userId);
        const bioEnabled = await SecureStore.getItemAsync("sv_biometric_enabled");
        if (bioEnabled === "true") {
          await SecureStore.setItemAsync("sv_biometric_master", newPassword);
        }
        return true;
      } catch {
        return false;
      }
    },
    [pbkdf2Salt, token, user, encryptionKey, secrets, syncToServer]
  );

  return (
    <VaultContext.Provider
      value={{
        vaultStatus,
        secrets,
        unlock,
        lock,
        addSecret,
        updateSecret,
        deleteSecret,
        toggleFavorite,
        changePassword,
        isSyncing,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be inside VaultProvider");
  return ctx;
}
