import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface PasswordGeneratorProps {
  visible: boolean;
  onClose: () => void;
  onUse?: (password: string) => void;
}

const CHARS = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{}|;:,.<>?",
};

function generatePassword(
  length: number,
  useUpper: boolean,
  useLower: boolean,
  useNumbers: boolean,
  useSymbols: boolean
): string {
  let charset = "";
  if (useUpper) charset += CHARS.upper;
  if (useLower) charset += CHARS.lower;
  if (useNumbers) charset += CHARS.numbers;
  if (useSymbols) charset += CHARS.symbols;
  if (!charset) charset = CHARS.lower + CHARS.numbers;

  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  return password;
}

function getStrength(password: string): { label: string; color: string; level: number } {
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 20) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { label: "Weak", color: "#ef4444", level: 1 };
  if (score <= 4) return { label: "Fair", color: "#f97316", level: 2 };
  if (score <= 5) return { label: "Strong", color: "#22c55e", level: 3 };
  return { label: "Very Strong", color: "#16a34a", level: 4 };
}

export default function PasswordGenerator({
  visible,
  onClose,
  onUse,
}: PasswordGeneratorProps) {
  const colors = useColors();
  const [length, setLength] = useState(20);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [generated, setGenerated] = useState("");
  const [copied, setCopied] = useState(false);

  const regenerate = useCallback(() => {
    const pw = generatePassword(length, useUpper, useLower, useNumbers, useSymbols);
    setGenerated(pw);
    setCopied(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [length, useUpper, useLower, useNumbers, useSymbols]);

  useEffect(() => {
    if (visible) regenerate();
  }, [visible]);

  useEffect(() => {
    if (visible) regenerate();
  }, [length, useUpper, useLower, useNumbers, useSymbols]);

  async function handleCopy() {
    await Clipboard.setStringAsync(generated);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleUse() {
    if (onUse) {
      onUse(generated);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onClose();
  }

  const strength = getStrength(generated);

  const s = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: Platform.OS === "ios" ? 40 : 28,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: 20,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    title: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    pwBox: {
      backgroundColor: colors.input,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 8,
    },
    pwText: {
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      letterSpacing: 1,
      textAlign: "center",
    },
    strengthRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginBottom: 16,
    },
    strengthBars: {
      flexDirection: "row",
      gap: 4,
    },
    strengthBar: {
      height: 4,
      width: 28,
      borderRadius: 2,
    },
    strengthLabel: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 20,
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      height: 44,
      borderRadius: 10,
      backgroundColor: colors.secondary,
    },
    actionBtnText: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    sectionLabel: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 12,
    },
    lengthRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
      backgroundColor: colors.secondary,
      borderRadius: 10,
      padding: 4,
    },
    lengthBtn: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    lengthText: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      minWidth: 50,
      textAlign: "center",
    },
    lengthLabel: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    toggleRowLast: {
      borderBottomWidth: 0,
    },
    toggleLabel: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    useBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 16,
    },
    useBtnText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={s.sheet}>
            <View style={s.handle} />

            <View style={s.titleRow}>
              <Text style={s.title}>Password Generator</Text>
              <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={s.pwBox}>
              <Text style={s.pwText} numberOfLines={2} selectable>
                {generated}
              </Text>
            </View>

            <View style={s.strengthRow}>
              <View style={s.strengthBars}>
                {[1, 2, 3, 4].map((level) => (
                  <View
                    key={level}
                    style={[
                      s.strengthBar,
                      {
                        backgroundColor:
                          strength.level >= level ? strength.color : colors.border,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={[s.strengthLabel, { color: strength.color }]}>
                {strength.label}
              </Text>
            </View>

            <View style={s.actionRow}>
              <TouchableOpacity style={s.actionBtn} onPress={handleCopy}>
                <Feather
                  name={copied ? "check" : "copy"}
                  size={16}
                  color={copied ? colors.success : colors.foreground}
                />
                <Text style={[s.actionBtnText, copied && { color: colors.success }]}>
                  {copied ? "Copied!" : "Copy"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={regenerate}>
                <Feather name="refresh-cw" size={16} color={colors.foreground} />
                <Text style={s.actionBtnText}>Regenerate</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.sectionLabel}>Length — {length} characters</Text>
            <View style={s.lengthRow}>
              <TouchableOpacity
                style={s.lengthBtn}
                onPress={() => setLength((l) => Math.max(8, l - 1))}
              >
                <Feather name="minus" size={18} color={colors.foreground} />
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <Text style={s.lengthText}>{length}</Text>
                <Text style={s.lengthLabel}>characters</Text>
              </View>
              <TouchableOpacity
                style={s.lengthBtn}
                onPress={() => setLength((l) => Math.min(64, l + 1))}
              >
                <Feather name="plus" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <Text style={s.sectionLabel}>Character Sets</Text>
            {[
              { label: "Uppercase (A–Z)", value: useUpper, set: setUseUpper },
              { label: "Lowercase (a–z)", value: useLower, set: setUseLower },
              { label: "Numbers (0–9)", value: useNumbers, set: setUseNumbers },
              { label: "Symbols (!@#…)", value: useSymbols, set: setUseSymbols, last: true },
            ].map(({ label, value, set, last }) => (
              <View key={label} style={[s.toggleRow, last && s.toggleRowLast]}>
                <Text style={s.toggleLabel}>{label}</Text>
                <Switch
                  value={value}
                  onValueChange={set}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.primaryForeground}
                />
              </View>
            ))}

            {onUse && (
              <TouchableOpacity style={s.useBtn} onPress={handleUse} activeOpacity={0.85}>
                <Text style={s.useBtnText}>Use This Password</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
