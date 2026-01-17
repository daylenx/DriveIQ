import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthScreen from "@/screens/AuthScreen";
import AddVehicleModal from "@/screens/AddVehicleModal";
import LogMaintenanceModal from "@/screens/LogMaintenanceModal";
import UpdateOdometerModal from "@/screens/UpdateOdometerModal";
import VehicleSettingsModal from "@/screens/VehicleSettingsModal";
import UsageIntentScreen from "@/screens/UsageIntentScreen";
import PricingScreen from "@/screens/PricingScreen";
import FamilyManagementScreen from "@/screens/FamilyManagementScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/context/AuthContext";
import { ActivityIndicator, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { MaintenanceTask } from "@/types";

export type RootStackParamList = {
  Main: undefined;
  Auth: undefined;
  UsageIntent: undefined;
  Pricing: undefined;
  FamilyManagement: undefined;
  AddVehicle: { vehicleId?: string } | undefined;
  LogMaintenance: { task?: MaintenanceTask };
  UpdateOdometer: { vehicleId: string };
  VehicleSettings: { vehicleId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { user, isLoading, needsOnboarding } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.backgroundRoot }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {user ? (
        needsOnboarding ? (
          <Stack.Screen
            name="UsageIntent"
            component={UsageIntentScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Pricing"
              component={PricingScreen}
              options={{
                presentation: "modal",
                headerTitle: "Plans",
              }}
            />
            <Stack.Screen
              name="FamilyManagement"
              component={FamilyManagementScreen}
              options={{
                presentation: "modal",
                headerTitle: "Members",
              }}
            />
            <Stack.Screen
              name="AddVehicle"
              component={AddVehicleModal}
              options={{
                presentation: "modal",
                headerTitle: "Add Vehicle",
              }}
            />
            <Stack.Screen
              name="LogMaintenance"
              component={LogMaintenanceModal}
              options={{
                presentation: "modal",
                headerTitle: "Log Service",
              }}
            />
            <Stack.Screen
              name="UpdateOdometer"
              component={UpdateOdometerModal}
              options={{
                presentation: "modal",
                headerTitle: "Update Odometer",
              }}
            />
            <Stack.Screen
              name="VehicleSettings"
              component={VehicleSettingsModal}
              options={{
                presentation: "modal",
                headerTitle: "Vehicle Settings",
              }}
            />
          </>
        )
      ) : (
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}
