import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LogsScreen from "@/screens/LogsScreen";
import LogDetailScreen from "@/screens/LogDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type LogsStackParamList = {
  Logs: undefined;
  LogDetail: { logId: string };
};

const Stack = createNativeStackNavigator<LogsStackParamList>();

export default function LogsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Logs"
        component={LogsScreen}
        options={{
          headerTitle: "Service Logs",
        }}
      />
      <Stack.Screen
        name="LogDetail"
        component={LogDetailScreen}
        options={{
          headerTitle: "Log Details",
        }}
      />
    </Stack.Navigator>
  );
}
