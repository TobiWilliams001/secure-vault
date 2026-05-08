import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PasswordGenerator from "@/components/PasswordGenerator";
import SecretCard from "@/components/SecretCard";
import { SecretCategory, useVault, VaultSecret } from "@/context/VaultContext";
import { useColors } from "@/hooks/useColors";

const FILTERS: { label: string; value: SecretCategory | "all" | "favorites" }[] = [
  { label: "All", value: "all" },
  { label: "Favorites", value: "favorites" },
  { label: "Passwords", value: "password" },
  { label: "Seeds", value: "seed" },
  { label: "Notes", value: "note" },
  { label: "Cards", value: "card" },
];

export default function VaultScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { secrets, lock, toggleFavorite, isSyncing } = useVault();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SecretCategory | "all" | "favorites">("all");
  const [showGenerator, setShowGenerator] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const filtered = useMemo(() => {
    let list = secrets;
    if (filter === "favorites") list = list.filter((s) => s.favorite);
    else if (filter !== "all") list = list.filter((s) => s.category === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.title.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [secrets, filter, search]);

  function handleAdd() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/edit");
  }

  function handleLock() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    lock();
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: topPad + 8,
      paddingHorizontal: 20,
      paddingBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    headerTitle: {
      fontSize: 24,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    syncDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginLeft: 4,
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
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.input,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: 20,
      marginBottom: 12,
      paddingHorizontal: 12,
      height: 44,
    },
    searchInput: {
      flex: 1,
      color: colors.foreground,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      marginLeft: 8,
    },
    filterRow: {
      paddingLeft: 20,
      marginBottom: 16,
    },
    filterBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.secondary,
      marginRight: 8,
    },
    filterBtnActive: {
      backgroundColor: colors.primary,
    },
    filterText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    filterTextActive: {
      color: colors.primaryForeground,
    },
    list: {
      paddingHorizontal: 20,
    },
    emptyWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 80,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      paddingHorizontal: 32,
    },
    fabRow: {
      position: "absolute",
      right: 20,
      bottom: bottomPad + 20,
      flexDirection: "column",
      gap: 12,
      alignItems: "flex-end",
    },
    fabSecondary: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    countText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      paddingHorizontal: 20,
      marginBottom: 8,
    },
  });

  function renderSecret({ item }: { item: VaultSecret }) {
    return (
      <SecretCard
        secret={item}
        onPress={() => router.push(`/view/${item.id}`)}
        onFavorite={() => toggleFavorite(item.id)}
      />
    );
  }

  function renderEmpty() {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIcon}>
          <Feather name="lock" size={28} color={colors.mutedForeground} />
        </View>
        <Text style={styles.emptyTitle}>
          {search ? "No results" : "Your vault is empty"}
        </Text>
        <Text style={styles.emptyText}>
          {search
            ? "Try a different search term"
            : "Tap the + button to add your first secret"}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Vault</Text>
          {isSyncing && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push("/settings")}
          >
            <Feather name="settings" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleLock}>
            <Feather name="lock" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search secrets..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={(f) => f.value}
        style={styles.filterRow}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterBtn,
              filter === item.value && styles.filterBtnActive,
            ]}
            onPress={() => setFilter(item.value)}
          >
            <Text
              style={[
                styles.filterText,
                filter === item.value && styles.filterTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {filtered.length > 0 && (
        <Text style={styles.countText}>
          {filtered.length} {filtered.length === 1 ? "secret" : "secrets"}
        </Text>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        renderItem={renderSecret}
        contentContainerStyle={[
          styles.list,
          filtered.length === 0 && { flex: 1 },
        ]}
        ListEmptyComponent={renderEmpty}
        scrollEnabled={!!filtered.length}
        showsVerticalScrollIndicator={false}
        contentInset={{ bottom: 90 }}
      />

      <View style={styles.fabRow}>
        <TouchableOpacity
          style={styles.fabSecondary}
          onPress={() => setShowGenerator(true)}
          activeOpacity={0.8}
        >
          <Feather name="zap" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={handleAdd} activeOpacity={0.8}>
          <Feather name="plus" size={26} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <PasswordGenerator
        visible={showGenerator}
        onClose={() => setShowGenerator(false)}
      />
    </View>
  );
}
