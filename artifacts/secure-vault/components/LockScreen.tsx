import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useVault } from "@/context/VaultContext";
import {
  authenticateWithBiometric,
  getBiometricMasterPassword,
  isBiometricAvailable,
  isBiometricEnabled,
} from "@/hooks/useBiometric";
import { useColors } from "@/hooks/useColors";

export default function LockScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { unlock } = useVault();

  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isBioLoading, setIsBioLoading] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    void checkAndAutoTriggerBiometric();
  }, []);

  async function checkAndAutoTriggerBiometric() {
    const [enabled, available] = await Promise.all([
      isBiometricEnabled(),
      isBiometricAvailable(),
    ]);
    if (enabled && available) {
      setBioAvailable(true);
      void triggerBiometric();
    }
  }

  async function triggerBiometric() {
    setIsBioLoading(true);
    try {
      const authed = await authenticateWithBiometric("Unlock Secure Vault");
      if (authed) {
        const mp = await getBiometricMasterPassword();
        if (mp) {
          const ok = await unlock(mp);
          if (!ok) {
            setError("Biometric unlock failed — enter your password.");
            shake();
          }
        }
      }
    } finally {
      setIsBioLoading(false);
    }
  }

  function shake() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  async function handleUnlock() {
    if (!password) {
      setError("Please enter your master password");
      shake();
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const ok = await unlock(password);
      if (!ok) {
        setError("Incorrect password");
        shake();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setError("Failed to unlock vault");
      shake();
    } finally {
      setIsLoading(false);
    }
  }

  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: topPad,
    },
    inner: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: 24,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.primary + "40",
    },
    title: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 8,
      textAlign: "center",
    },
    email: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.primary,
      marginBottom: 32,
    },
    inputWrap: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.input,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      paddingHorizontal: 16,
    },
    input: {
      flex: 1,
      height: 52,
      color: colors.foreground,
      fontSize: 16,
      fontFamily: "Inter_400Regular",
    },
    eyeBtn: { padding: 4 },
    error: {
      color: colors.destructive,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      marginBottom: 12,
      textAlign: "center",
    },
    btn: {
      width: "100%",
      height: 52,
      borderRadius: colors.radius,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
    },
    bioBtn: {
      width: "100%",
      height: 52,
      borderRadius: colors.radius,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
      marginTop: 12,
    },
    bioBtnText: {
      color: colors.foreground,
      fontSize: 15,
      fontFamily: "Inter_500Medium",
    },
    hint: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 24,
      textAlign: "center",
    },
  });

  return (
    <View style={s.container}>
      <View style={s.inner}>
        <View style={s.iconWrap}>
          <Feather name="shield" size={36} color={colors.primary} />
        </View>

        <Text style={s.title}>Secure Vault</Text>
        <Text style={s.subtitle}>Enter your master password to unlock</Text>
        {user?.email && <Text style={s.email}>{user.email}</Text>}

        <Animated.View
          style={{ width: "100%", transform: [{ translateX: shakeAnim }] }}
        >
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              placeholder="Master password"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(""); }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleUnlock}
            />
            <TouchableOpacity
              style={s.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
            >
              <Feather
                name={showPassword ? "eye-off" : "eye"}
                size={20}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {!!error && <Text style={s.error}>{error}</Text>}

        <TouchableOpacity
          style={[s.btn, isLoading && s.btnDisabled]}
          onPress={handleUnlock}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={s.btnText}>Unlock</Text>
          )}
        </TouchableOpacity>

        {bioAvailable && (
          <TouchableOpacity
            style={[s.bioBtn, isBioLoading && s.btnDisabled]}
            onPress={triggerBiometric}
            disabled={isBioLoading}
            activeOpacity={0.8}
          >
            {isBioLoading ? (
              <ActivityIndicator color={colors.foreground} size="small" />
            ) : (
              <>
                <Feather name="cpu" size={18} color={colors.foreground} />
                <Text style={s.bioBtnText}>Use Face ID / Touch ID</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <Text style={s.hint}>All secrets are encrypted on-device. Only you hold the key.</Text>
      </View>
    </View>
  );
}
