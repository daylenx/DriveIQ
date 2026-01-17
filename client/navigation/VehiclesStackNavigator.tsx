import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import VehiclesScreen from "@/screens/VehiclesScreen";
import VehicleDetailScreen from "@/screens/VehicleDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type VehiclesStackParamList = {
  Vehicles: undefined;
  VehicleDetail: { vehicleId: string };
};

const Stack = createNativeStackNavigator<VehiclesStackParamList>();

export default function VehiclesStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Vehicles"
        component={VehiclesScreen}
        options={{
          headerTitle: "Vehicles",
        }}
      />
      <Stack.Screen
        name="VehicleDetail"
        component={VehicleDetailScreen}
        options={{
          headerTitle: "Vehicle Details",
        }}
      />
    </Stack.Navigator>
  );
}
