import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MaintenanceScreen from "@/screens/MaintenanceScreen";
import TaskDetailScreen from "@/screens/TaskDetailScreen";
import LogMaintenanceModal from "@/screens/LogMaintenanceModal";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { MaintenanceTask } from "@/types";

export type MaintenanceStackParamList = {
  MaintenanceList: undefined;
  TaskDetail: { task: MaintenanceTask };
  LogMaintenance: { task: MaintenanceTask };
};

const Stack = createNativeStackNavigator<MaintenanceStackParamList>();

export default function MaintenanceStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="MaintenanceList"
        component={MaintenanceScreen}
        options={{ headerTitle: "Maintenance" }}
      />
      <Stack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ headerTitle: "Task Details" }}
      />
      <Stack.Screen
        name="LogMaintenance"
        component={LogMaintenanceModal}
        options={{
          presentation: "modal",
          headerTitle: "Log Service",
        }}
      />
    </Stack.Navigator>
  );
}
