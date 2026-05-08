import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import LockScreen from "@/components/LockScreen";
import { useAuth } from "@/context/AuthContext";
import { useVault } from "@/context/VaultContext";
import { useColors } from "@/hooks/useColors";

export default function IndexScreen() {
  const colors = useColors();
  const { status: authStatus } = useAuth();
  const { vaultStatus } = useVault();

  if (authStatus === "loading") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (authStatus === "unauthenticated") {
    return <Redirect href="/auth/login" />;
  }

  if (vaultStatus === "locked") {
    return <LockScreen />;
  }

  return <Redirect href="/vault" />;
}
