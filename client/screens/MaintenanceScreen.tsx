import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useHeaderHeight } from "@react-navigation/elements";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useData } from "@/context/DataContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { MaintenanceStackParamList } from "@/navigation/MaintenanceStackNavigator";
import { formatMiles } from "@/lib/storage";
import { DashboardTask, MaintenanceTask } from "@/types";

type NavigationProp = NativeStackNavigationProp<MaintenanceStackParamList>;

export default function MaintenanceScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { dashboardTasks, activeVehicle, vehicles, isLoading, refreshData, maintenanceTasks } = useData();
  const tabBarHeight = useBottomTabBarHeight();
  const headerHeight = useHeaderHeight();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const filteredTasks = selectedVehicleId
    ? dashboardTasks.filter((t) => t.vehicleId === selectedVehicleId)
    : activeVehicle
    ? dashboardTasks.filter((t) => t.vehicleId === activeVehicle.id)
    : dashboardTasks;

  const categories = [...new Set(filteredTasks.map((t) => t.category))].sort();

  const getStatusColor = (status: DashboardTask["status"]) => {
    switch (status) {
      case "overdue":
        return theme.danger;
      case "dueSoon":
        return theme.warning;
      default:
        return theme.textSecondary;
    }
  };

  const getStatusLabel = (status: DashboardTask["status"]) => {
    switch (status) {
      case "overdue":
        return "Overdue";
      case "dueSoon":
        return "Due Soon";
      default:
        return "Upcoming";
    }
  };

  const handleTaskPress = (task: DashboardTask) => {
    const fullTask = maintenanceTasks.find((t) => t.id === task.id);
    if (fullTask) {
      navigation.navigate("TaskDetail", { task: fullTask });
    }
  };

  const handleLogPress = (task: DashboardTask) => {
    const fullTask = maintenanceTasks.find((t) => t.id === task.id);
    if (fullTask) {
      navigation.navigate("LogMaintenance", { task: fullTask });
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refreshData} />
        }
      >
        {vehicles.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.vehicleFilter}
            contentContainerStyle={styles.vehicleFilterContent}
          >
            <Pressable
              onPress={() => setSelectedVehicleId(null)}
              style={[
                styles.vehicleChip,
                {
                  backgroundColor: !selectedVehicleId
                    ? theme.primary
                    : theme.backgroundDefault,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.vehicleChipText,
                  { color: !selectedVehicleId ? theme.buttonText : theme.text },
                ]}
              >
                Active
              </ThemedText>
            </Pressable>
            {vehicles.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => setSelectedVehicleId(v.id)}
                style={[
                  styles.vehicleChip,
                  {
                    backgroundColor:
                      selectedVehicleId === v.id
                        ? theme.primary
                        : theme.backgroundDefault,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.vehicleChipText,
                    {
                      color:
                        selectedVehicleId === v.id ? theme.buttonText : theme.text,
                    },
                  ]}
                >
                  {v.nickname || `${v.year} ${v.make}`}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {filteredTasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundDefault }]}>
              <Feather
                name={vehicles.length === 0 ? "truck" : "check-circle"}
                size={48}
                color={vehicles.length === 0 ? theme.primary : theme.textSecondary}
              />
            </View>
            {vehicles.length === 0 ? (
              <>
                <ThemedText type="h3" style={styles.emptyTitle}>
                  No Vehicles Yet
                </ThemedText>
                <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  Add your first vehicle to see maintenance tasks and schedules.
                </ThemedText>
              </>
            ) : (
              <>
                <ThemedText type="h3" style={styles.emptyTitle}>
                  All Caught Up
                </ThemedText>
                <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  No maintenance items need attention right now. Keep driving safely.
                </ThemedText>
              </>
            )}
          </View>
        ) : (
          categories.map((category) => {
            const categoryTasks = filteredTasks.filter((t) => t.category === category);
            return (
              <View key={category} style={styles.categorySection}>
                <ThemedText type="h4" style={styles.categoryTitle}>
                  {category}
                </ThemedText>
                {categoryTasks.map((task) => (
                  <Card key={task.id} style={styles.taskCard}>
                    <Pressable
                      onPress={() => handleTaskPress(task)}
                      style={styles.taskContent}
                    >
                      <View style={styles.taskHeader}>
                        <ThemedText type="body" style={styles.taskName}>
                          {task.name}
                        </ThemedText>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: getStatusColor(task.status) + "20" },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.statusText,
                              { color: getStatusColor(task.status) },
                            ]}
                          >
                            {getStatusLabel(task.status)}
                          </ThemedText>
                        </View>
                      </View>
                      <View style={styles.taskDetails}>
                        {task.milesRemaining !== null ? (
                          <ThemedText type="small" style={styles.taskMeta}>
                            {(() => {
                              const taskVehicle = vehicles.find(v => v.id === task.vehicleId);
                              const unit = taskVehicle?.odometerUnit === 'km' ? 'km' : 'mi';
                              return task.milesRemaining > 0
                                ? `${formatMiles(task.milesRemaining)} ${unit} remaining`
                                : `${formatMiles(Math.abs(task.milesRemaining))} ${unit} overdue`;
                            })()}
                          </ThemedText>
                        ) : null}
                        {task.daysRemaining !== null ? (
                          <ThemedText type="small" style={styles.taskMeta}>
                            {task.daysRemaining > 0
                              ? `${task.daysRemaining} days remaining`
                              : `${Math.abs(task.daysRemaining)} days overdue`}
                          </ThemedText>
                        ) : null}
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => handleLogPress(task)}
                      style={[styles.logButton, { backgroundColor: theme.primary }]}
                    >
                      <Feather name="check" size={18} color={theme.buttonText} />
                      <ThemedText style={[styles.logButtonText, { color: theme.buttonText }]}>
                        Log
                      </ThemedText>
                    </Pressable>
                  </Card>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  vehicleFilter: {
    marginBottom: Spacing.sm,
  },
  vehicleFilterContent: {
    gap: Spacing.sm,
  },
  vehicleChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  vehicleChipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing["3xl"],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: "center",
  },
  categorySection: {
    gap: Spacing.sm,
  },
  categoryTitle: {
    marginBottom: Spacing.xs,
  },
  taskCard: {
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  taskContent: {
    flex: 1,
  },
  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  taskName: {
    flex: 1,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  taskDetails: {
    marginTop: Spacing.xs,
    gap: 2,
  },
  taskMeta: {
    opacity: 0.7,
  },
  logButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  logButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
