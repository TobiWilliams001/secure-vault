import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import SecretFieldRow from "@/components/SecretFieldRow";
import { useVault } from "@/context/VaultContext";
import { useColors } from "@/hooks/useColors";

const CATEGORY_ICONS: Record<string, string> = {
  password: "lock",
  seed: "key",
  note: "file-text",
  card: "credit-card",
};

const CATEGORY_COLORS: Record<string, string> = {
  password: "#3b82f6",
  seed: "#a855f7",
  note: "#22c55e",
  card: "#f59e0b",
};

export default function ViewSecretScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { secrets, deleteSecret, toggleFavorite } = useVault();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const secret = secrets.find((s) => s.id === id);

  if (!secret) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
          Secret not found
        </Text>
      </View>
    );
  }

  const catColor = CATEGORY_COLORS[secret.category] ?? colors.primary;

  function handleDelete() {
    Alert.alert(
      "Delete Secret",
      `Are you sure you want to delete "${secret?.title}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteSecret(id);
            router.back();
          },
        },
      ]
    );
  }

  function handleFavorite() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavorite(id);
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: topPad + 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
      flexDirection: "row",
      alignItems: "center",
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    headerActions: {
      flexDirection: "row",
      gap: 8,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: bottomPad + 40,
    },
    heroCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius + 4,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      alignItems: "center",
      marginBottom: 20,
    },
    catIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    secretTitle: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 4,
    },
    categoryLabel: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    sectionLabel: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 10,
      marginTop: 4,
    },
    metaCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginTop: 16,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 4,
    },
    metaLabel: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      width: 80,
    },
    metaValue: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    deleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 24,
      padding: 14,
      borderRadius: colors.radius,
      backgroundColor: colors.destructive + "18",
      borderWidth: 1,
      borderColor: colors.destructive + "40",
      gap: 8,
    },
    deleteBtnText: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.destructive,
    },
  });

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {secret.title}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleFavorite}>
            <Feather
              name="star"
              size={18}
              color={secret.favorite ? colors.warning : colors.mutedForeground}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push(`/edit?id=${id}`)}
          >
            <Feather name="edit-2" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View
            style={[
              styles.catIconWrap,
              { backgroundColor: catColor + "20" },
            ]}
          >
            <Feather
              name={CATEGORY_ICONS[secret.category] as any}
              size={26}
              color={catColor}
            />
          </View>
          <Text style={styles.secretTitle}>{secret.title}</Text>
          <Text style={styles.categoryLabel}>
            {secret.category.charAt(0).toUpperCase() + secret.category.slice(1)}
            {secret.favorite ? " · Starred" : ""}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Fields</Text>
        {secret.fields.map((field, i) => (
          <SecretFieldRow key={i} field={field} />
        ))}

        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Created</Text>
            <Text style={styles.metaValue}>{formatDate(secret.createdAt)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Updated</Text>
            <Text style={styles.metaValue}>{formatDate(secret.updatedAt)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Feather name="trash-2" size={16} color={colors.destructive} />
          <Text style={styles.deleteBtnText}>Delete Secret</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
