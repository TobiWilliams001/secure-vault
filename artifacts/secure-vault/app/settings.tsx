import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
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
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
} from "@/hooks/useBiometric";
import { useColors } from "@/hooks/useColors";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, deleteAccount } = useAuth();
  const { lock, changePassword, secrets } = useVault();

  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPwForm, setShowPwForm] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    void loadBiometricState();
  }, []);

  async function loadBiometricState() {
    const [enabled, available] = await Promise.all([
      isBiometricEnabled(),
      isBiometricAvailable(),
    ]);
    setBioAvailable(available);
    setBioOn(enabled && available);
  }

  async function handleToggleBiometric(value: boolean) {
    if (value) {
      const authed = await authenticateWithBiometric("Confirm biometric unlock");
      if (!authed) return;
      Alert.alert(
        "Enter Master Password",
        "We need to store your master password securely in the device enclave for biometric unlock.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            onPress: () => promptMasterPasswordForBio(),
          },
        ]
      );
    } else {
      await setBiometricEnabled(false);
      setBioOn(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  function promptMasterPasswordForBio() {
    Alert.prompt(
      "Master Password",
      "Enter your master password to enable biometric unlock",
      async (pw) => {
        if (!pw) return;
        await setBiometricEnabled(true, pw);
        setBioOn(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      "secure-text"
    );
  }

  async function handleChangePassword() {
    if (!oldPass || !newPass || !confirmPass) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (newPass.length < 8) {
      Alert.alert("Error", "New password must be at least 8 characters");
      return;
    }
    if (newPass !== confirmPass) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }
    setIsChanging(true);
    const ok = await changePassword(oldPass, newPass);
    setIsChanging(false);
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Vault re-encrypted with your new master password.");
      setOldPass(""); setNewPass(""); setConfirmPass(""); setShowPwForm(false);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Current password is incorrect");
    }
  }

  function handleLockVault() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    lock();
    router.replace("/");
  }

  async function handleLogout() {
    Alert.alert(
      "Sign Out",
      "Your vault will be locked. Sign back in to access your data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            lock();
            await logout();
            router.replace("/");
          },
        },
      ]
    );
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This permanently deletes your account and all vault data on the server. You will lose all your secrets if you haven't exported them. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            lock();
            await deleteAccount();
            router.replace("/");
          },
        },
      ]
    );
  }

  const counts = {
    total: secrets.length,
    favorites: secrets.filter((s) => s.favorite).length,
    seeds: secrets.filter((s) => s.category === "seed").length,
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
      flexDirection: "row",
      alignItems: "center",
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 10,
      backgroundColor: colors.secondary,
      alignItems: "center", justifyContent: "center", marginRight: 12,
    },
    headerTitle: {
      flex: 1, fontSize: 18,
      fontFamily: "Inter_600SemiBold", color: colors.foreground,
    },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: bottomPad + 40 },
    section: { marginBottom: 24 },
    sectionLabel: {
      fontSize: 11, fontFamily: "Inter_500Medium",
      color: colors.mutedForeground, textTransform: "uppercase",
      letterSpacing: 0.6, marginBottom: 10,
    },
    card: {
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    row: {
      flexDirection: "row", alignItems: "center", padding: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowIcon: {
      width: 36, height: 36, borderRadius: 8,
      alignItems: "center", justifyContent: "center", marginRight: 12,
    },
    rowLabel: {
      flex: 1, fontSize: 15,
      fontFamily: "Inter_500Medium", color: colors.foreground,
    },
    rowValue: {
      fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground,
    },
    statRow: { flexDirection: "row", gap: 12 },
    statCard: {
      flex: 1, backgroundColor: colors.card,
      borderRadius: colors.radius, borderWidth: 1,
      borderColor: colors.border, padding: 16, alignItems: "center",
    },
    statValue: {
      fontSize: 28, fontFamily: "Inter_700Bold",
      color: colors.foreground, marginBottom: 4,
    },
    statLabel: {
      fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground,
    },
    formCard: {
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 10,
    },
    inputWrap: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.input, borderRadius: 8,
      borderWidth: 1, borderColor: colors.border,
      marginBottom: 10, paddingHorizontal: 12,
    },
    input: {
      flex: 1, height: 44, color: colors.foreground,
      fontSize: 15, fontFamily: "Inter_400Regular",
    },
    eyeBtn: { padding: 4 },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 8, padding: 12, alignItems: "center",
    },
    saveBtnText: {
      color: colors.primaryForeground,
      fontFamily: "Inter_600SemiBold", fontSize: 14,
    },
    actionBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      padding: 14, borderRadius: colors.radius,
      backgroundColor: colors.card, borderWidth: 1,
      borderColor: colors.border, gap: 8, marginBottom: 10,
    },
    actionBtnText: {
      fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground,
    },
    destructiveBtn: { borderColor: colors.destructive + "50" },
    destructiveBtnText: { color: colors.destructive },
    userCard: {
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, padding: 14,
      flexDirection: "row", alignItems: "center", gap: 12,
    },
    userAvatar: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.primary + "20",
      alignItems: "center", justifyContent: "center",
    },
    userEmail: {
      fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground,
    },
    userLabel: {
      fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground,
    },
    about: { alignItems: "center", paddingTop: 8 },
    aboutText: {
      fontSize: 12, fontFamily: "Inter_400Regular",
      color: colors.mutedForeground, textAlign: "center", lineHeight: 18,
    },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {user && (
          <View style={[s.section]}>
            <Text style={s.sectionLabel}>Account</Text>
            <View style={s.userCard}>
              <View style={s.userAvatar}>
                <Feather name="user" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={s.userEmail}>{user.email}</Text>
                <Text style={s.userLabel}>Signed in</Text>
              </View>
            </View>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionLabel}>Vault Stats</Text>
          <View style={s.statRow}>
            <View style={s.statCard}>
              <Text style={s.statValue}>{counts.total}</Text>
              <Text style={s.statLabel}>Total</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>{counts.favorites}</Text>
              <Text style={s.statLabel}>Starred</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>{counts.seeds}</Text>
              <Text style={s.statLabel}>Seeds</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Security</Text>
          <View style={s.card}>
            {bioAvailable && (
              <View style={s.row}>
                <View style={[s.rowIcon, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name="cpu" size={18} color={colors.primary} />
                </View>
                <Text style={s.rowLabel}>Face ID / Touch ID</Text>
                <Switch
                  value={bioOn}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.primaryForeground}
                />
              </View>
            )}

            <TouchableOpacity
              style={s.row}
              onPress={() => setShowPwForm(!showPwForm)}
            >
              <View style={[s.rowIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="key" size={18} color={colors.primary} />
              </View>
              <Text style={s.rowLabel}>Change Master Password</Text>
              <Feather
                name={showPwForm ? "chevron-up" : "chevron-right"}
                size={18}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>

            <View style={[s.row, s.rowLast]}>
              <View style={[s.rowIcon, { backgroundColor: colors.success + "20" }]}>
                <Feather name="shield" size={18} color={colors.success} />
              </View>
              <Text style={s.rowLabel}>Encryption</Text>
              <Text style={s.rowValue}>AES-256 + PBKDF2</Text>
            </View>
          </View>

          {showPwForm && (
            <View style={s.formCard}>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  placeholder="Current password"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showOld}
                  value={oldPass}
                  onChangeText={setOldPass}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowOld(!showOld)}>
                  <Feather
                    name={showOld ? "eye-off" : "eye"}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  placeholder="New password (min. 8 chars)"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showNew}
                  value={newPass}
                  onChangeText={setNewPass}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowNew(!showNew)}>
                  <Feather
                    name={showNew ? "eye-off" : "eye"}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
              <View style={[s.inputWrap, { marginBottom: 12 }]}>
                <TextInput
                  style={s.input}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showNew}
                  value={confirmPass}
                  onChangeText={setConfirmPass}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <TouchableOpacity
                style={[s.saveBtn, isChanging && { opacity: 0.6 }]}
                onPress={handleChangePassword}
                disabled={isChanging}
              >
                <Text style={s.saveBtnText}>
                  {isChanging ? "Re-encrypting…" : "Update Password"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Session</Text>
          <TouchableOpacity style={s.actionBtn} onPress={handleLockVault}>
            <Feather name="lock" size={18} color={colors.foreground} />
            <Text style={s.actionBtnText}>Lock Vault</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, s.destructiveBtn]}
            onPress={handleLogout}
          >
            <Feather name="log-out" size={18} color={colors.destructive} />
            <Text style={[s.actionBtnText, s.destructiveBtnText]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Danger Zone</Text>
          <TouchableOpacity
            style={[s.actionBtn, s.destructiveBtn]}
            onPress={handleDeleteAccount}
          >
            <Feather name="trash-2" size={18} color={colors.destructive} />
            <Text style={[s.actionBtnText, s.destructiveBtnText]}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <View style={s.about}>
          <Feather
            name="shield"
            size={24}
            color={colors.mutedForeground}
            style={{ marginBottom: 8 }}
          />
          <Text style={s.aboutText}>
            Secure Vault v2.0 — Zero-Knowledge Architecture{"\n"}
            AES-256-CTR + PBKDF2 (100k iterations){"\n"}
            Your master password never leaves your device.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
