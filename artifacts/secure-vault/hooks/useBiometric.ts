import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_ENABLED_KEY = "sv_biometric_enabled";
const BIOMETRIC_MASTER_KEY = "sv_biometric_master";

async function getLocalAuth() {
  if (Platform.OS === "web") return null;
  try {
    return await import("expo-local-authentication");
  } catch {
    return null;
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  const LocalAuth = await getLocalAuth();
  if (!LocalAuth) return false;
  const [compatible, enrolled] = await Promise.all([
    LocalAuth.hasHardwareAsync(),
    LocalAuth.isEnrolledAsync(),
  ]);
  return compatible && enrolled;
}

export async function authenticateWithBiometric(
  promptMessage = "Unlock your vault"
): Promise<boolean> {
  const LocalAuth = await getLocalAuth();
  if (!LocalAuth) return false;
  const result = await LocalAuth.authenticateAsync({
    promptMessage,
    fallbackLabel: "Use password",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });
  return result.success;
}

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return val === "true";
}

export async function setBiometricEnabled(
  enabled: boolean,
  masterPassword?: string
): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? "true" : "false");
  if (enabled && masterPassword) {
    await SecureStore.setItemAsync(BIOMETRIC_MASTER_KEY, masterPassword);
  } else if (!enabled) {
    await SecureStore.deleteItemAsync(BIOMETRIC_MASTER_KEY).catch(() => {});
  }
}

export async function getBiometricMasterPassword(): Promise<string | null> {
  return SecureStore.getItemAsync(BIOMETRIC_MASTER_KEY);
}
