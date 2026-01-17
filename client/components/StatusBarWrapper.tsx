import React from "react";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "@/hooks/useTheme";

export function StatusBarWrapper() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}
