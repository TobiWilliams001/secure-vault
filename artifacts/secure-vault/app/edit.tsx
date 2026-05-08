import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
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

import { SecretCategory, SecretField, useVault } from "@/context/VaultContext";
import { useColors } from "@/hooks/useColors";

const CATEGORIES: { label: string; value: SecretCategory; icon: string }[] = [
  { label: "Password", value: "password", icon: "lock" },
  { label: "Seed / Key", value: "seed", icon: "key" },
  { label: "Secure Note", value: "note", icon: "file-text" },
  { label: "Card", value: "card", icon: "credit-card" },
];

const DEFAULT_FIELDS: Record<SecretCategory, SecretField[]> = {
  password: [
    { label: "Username / Email", value: "", sensitive: false },
    { label: "Password", value: "", sensitive: true },
    { label: "URL", value: "", sensitive: false },
    { label: "Notes", value: "", sensitive: false },
  ],
  seed: [
    { label: "Seed Phrase", value: "", sensitive: true },
    { label: "Wallet Address", value: "", sensitive: false },
    { label: "Notes", value: "", sensitive: false },
  ],
  note: [
    { label: "Content", value: "", sensitive: true },
  ],
  card: [
    { label: "Card Number", value: "", sensitive: true },
    { label: "Cardholder Name", value: "", sensitive: false },
    { label: "Expiry", value: "", sensitive: false },
    { label: "CVV", value: "", sensitive: true },
    { label: "Notes", value: "", sensitive: false },
  ],
};

export default function EditScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { secrets, addSecret, updateSecret } = useVault();

  const existing = id ? secrets.find((s) => s.id === id) : null;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState<SecretCategory>(existing?.category ?? "password");
  const [fields, setFields] = useState<SecretField[]>(
    existing?.fields ?? DEFAULT_FIELDS["password"]
  );
  const [favorite, setFavorite] = useState(existing?.favorite ?? false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (!existing) {
      setFields(DEFAULT_FIELDS[category]);
    }
  }, [category]);

  function updateField(index: number, key: keyof SecretField, value: string | boolean) {
    setFields((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function addField() {
    setFields((prev) => [...prev, { label: "Custom field", value: "", sensitive: false }]);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert("Title required", "Please enter a title for this secret.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (existing) {
      await updateSecret(existing.id, { title: title.trim(), category, fields, favorite });
    } else {
      await addSecret({ title: title.trim(), category, fields, favorite });
    }
    router.back();
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
    saveBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    saveBtnText: {
      color: colors.primaryForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: bottomPad + 24,
    },
    sectionLabel: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 8,
      marginTop: 16,
    },
    titleInput: {
      backgroundColor: colors.input,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.foreground,
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      padding: 14,
    },
    categoryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    catBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.secondary,
      gap: 6,
    },
    catBtnActive: {
      backgroundColor: colors.primary,
    },
    catText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    catTextActive: {
      color: colors.primaryForeground,
    },
    fieldCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 10,
    },
    fieldLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    fieldLabelInput: {
      flex: 1,
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    fieldValueInput: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    fieldSensitiveRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
    },
    fieldSensitiveLabel: {
      flex: 1,
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    removeBtn: {
      padding: 4,
    },
    addFieldBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 12,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
      gap: 8,
    },
    addFieldText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    favoriteRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    favoriteLabel: {
      flex: 1,
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {existing ? "Edit Secret" : "New Secret"}
        </Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Title</Text>
        <TextInput
          style={styles.titleInput}
          placeholder="e.g. Gmail, MetaMask, Bank Account"
          placeholderTextColor={colors.mutedForeground}
          value={title}
          onChangeText={setTitle}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              style={[styles.catBtn, category === cat.value && styles.catBtnActive]}
              onPress={() => setCategory(cat.value)}
            >
              <Feather
                name={cat.icon as any}
                size={14}
                color={
                  category === cat.value
                    ? colors.primaryForeground
                    : colors.mutedForeground
                }
              />
              <Text
                style={[
                  styles.catText,
                  category === cat.value && styles.catTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Fields</Text>
        {fields.map((field, i) => (
          <View key={i} style={styles.fieldCard}>
            <View style={styles.fieldLabelRow}>
              <TextInput
                style={styles.fieldLabelInput}
                value={field.label}
                onChangeText={(v) => updateField(i, "label", v)}
                autoCapitalize="words"
              />
              {fields.length > 1 && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeField(i)}
                >
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={styles.fieldValueInput}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              placeholderTextColor={colors.mutedForeground}
              value={field.value}
              onChangeText={(v) => updateField(i, "value", v)}
              secureTextEntry={field.sensitive}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={!field.sensitive}
            />
            <View style={styles.fieldSensitiveRow}>
              <Text style={styles.fieldSensitiveLabel}>Sensitive (hidden by default)</Text>
              <Switch
                value={field.sensitive}
                onValueChange={(v) => updateField(i, "sensitive", v)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.primaryForeground}
              />
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addFieldBtn} onPress={addField}>
          <Feather name="plus" size={16} color={colors.mutedForeground} />
          <Text style={styles.addFieldText}>Add custom field</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Options</Text>
        <View style={styles.favoriteRow}>
          <Feather name="star" size={18} color={colors.warning} style={{ marginRight: 12 }} />
          <Text style={styles.favoriteLabel}>Mark as favorite</Text>
          <Switch
            value={favorite}
            onValueChange={setFavorite}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.primaryForeground}
          />
        </View>
      </ScrollView>
    </View>
  );
}
