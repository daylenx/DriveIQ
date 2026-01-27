import React, { useEffect, useCallback } from "react";
import { StyleSheet, LogBox } from "react-native";
import * as SplashScreen from "expo-splash-screen";

LogBox.ignoreLogs([
  "[RevenueCat]",
  "Error while tracking event sdk_initialized",
  "Cannot read property 'search' of undefined",
]);

// Prevent splash screen from auto-hiding until we're ready
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore errors - splash screen might already be hidden
});

import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { FamilyProvider } from "@/context/FamilyContext";
import { FleetProvider } from "@/context/FleetContext";
import { RevenueCatWrapper } from "@/components/RevenueCatWrapper";
import { StatusBarWrapper } from "@/components/StatusBarWrapper";
import { InvitePromptModal } from "@/components/InvitePromptModal";
import { FleetInvitePromptModal } from "@/components/FleetInvitePromptModal";

export default function App() {
  // Hide splash screen once the app layout is ready
  const onLayoutRootView = useCallback(async () => {
    try {
      await SplashScreen.hideAsync();
    } catch (e) {
      // Ignore errors - splash screen might already be hidden
    }
  }, []);

  // Also hide splash screen after a timeout as fallback
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root} onLayout={onLayoutRootView}>
            <KeyboardProvider>
              <ThemeProvider>
                <AuthProvider>
                  <RevenueCatWrapper>
                    <FamilyProvider>
                      <FleetProvider>
                        <DataProvider>
                          <NavigationContainer>
                            <RootStackNavigator />
                            <InvitePromptModal />
                            <FleetInvitePromptModal />
                          </NavigationContainer>
                        </DataProvider>
                      </FleetProvider>
                    </FamilyProvider>
                  </RevenueCatWrapper>
                </AuthProvider>
                <StatusBarWrapper />
              </ThemeProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
