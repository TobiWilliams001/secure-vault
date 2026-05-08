import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { SecretCategory, VaultSecret } from "@/context/VaultContext";

const CATEGORY_ICONS: Record<SecretCategory, string> = {
  password: "lock",
  seed: "key",
  note: "file-text",
  card: "credit-card",
};

const CATEGORY_LABELS: Record<SecretCategory, string> = {
  password: "Password",
  seed: "Seed / Key",
  note: "Secure Note",
  card: "Card",
};

interface SecretCardProps {
  secret: VaultSecret;
  onPress: () => void;
  onFavorite: () => void;
}

export default function SecretCard({ secret, onPress, onFavorite }: SecretCardProps) {
  const colors = useColors();

  const categoryColor =
    secret.category === "password"
      ? colors.categoryPassword
      : secret.category === "seed"
      ? colors.categorySeed
      : secret.category === "note"
      ? colors.categoryNote
      : colors.categoryCard;

  function handleFavorite() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFavorite();
  }

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    info: {
      flex: 1,
    },
    title: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 2,
    },
    categoryLabel: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    favBtn: {
      padding: 6,
    },
    chevron: {
      marginLeft: 4,
    },
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconWrap, { backgroundColor: categoryColor + "22" }]}>
        <Feather
          name={CATEGORY_ICONS[secret.category] as any}
          size={20}
          color={categoryColor}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {secret.title}
        </Text>
        <Text style={styles.categoryLabel}>{CATEGORY_LABELS[secret.category]}</Text>
      </View>
      <TouchableOpacity style={styles.favBtn} onPress={handleFavorite}>
        <Feather
          name={secret.favorite ? "star" : "star"}
          size={18}
          color={secret.favorite ? colors.warning : colors.mutedForeground}
        />
      </TouchableOpacity>
      <Feather
        name="chevron-right"
        size={18}
        color={colors.mutedForeground}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
}

export { CATEGORY_ICONS, CATEGORY_LABELS };
