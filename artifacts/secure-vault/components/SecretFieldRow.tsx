import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { SecretField } from "@/context/VaultContext";

interface SecretFieldRowProps {
  field: SecretField;
}

export default function SecretFieldRow({ field }: SecretFieldRowProps) {
  const colors = useColors();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(field.value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function maskValue(v: string) {
    return "•".repeat(Math.min(v.length, 16));
  }

  const styles = StyleSheet.create({
    row: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
    },
    label: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    valueRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    value: {
      flex: 1,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    actions: {
      flexDirection: "row",
      gap: 8,
      marginLeft: 8,
    },
    actionBtn: {
      padding: 4,
    },
    copiedText: {
      fontSize: 11,
      color: colors.success,
      fontFamily: "Inter_500Medium",
    },
  });

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{field.label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value} selectable={revealed}>
          {field.sensitive && !revealed ? maskValue(field.value) : field.value}
        </Text>
        <View style={styles.actions}>
          {copied ? (
            <Text style={styles.copiedText}>Copied!</Text>
          ) : (
            <TouchableOpacity style={styles.actionBtn} onPress={handleCopy}>
              <Feather name="copy" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          {field.sensitive && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setRevealed(!revealed)}
            >
              <Feather
                name={revealed ? "eye-off" : "eye"}
                size={16}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
