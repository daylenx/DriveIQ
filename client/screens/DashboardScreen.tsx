import React from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { Spacing, BorderRadius, Colors } from '@/constants/theme';
import { DashboardTask } from '@/types';
import { RootStackParamList } from '@/navigation/RootStackNavigator';
import { formatMiles } from '@/lib/storage';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { vehicles, dashboardTasks, activeVehicle, tipOfTheDay, maintenanceTasks } = useData();
  const { user } = useAuth();

  const showTips = user?.showTips !== false;

  const overdueTasks = dashboardTasks.filter((t) => t.status === 'overdue');
  const dueSoonTasks = dashboardTasks.filter((t) => t.status === 'dueSoon');
  const upcomingTasks = dashboardTasks.filter((t) => t.status === 'upcoming').slice(0, 5);

  const handleTaskPress = (task: DashboardTask) => {
    const fullTask = maintenanceTasks.find((t) => t.id === task.id);
    if (fullTask) {
      navigation.navigate('LogMaintenance', { task: fullTask });
    }
  };

  const renderTask = (task: DashboardTask, statusColor: string) => {
    const isEstimated = task.baselineType === 'estimated';
    const taskVehicle = vehicles.find(v => v.id === task.vehicleId);
    const unit = taskVehicle?.odometerUnit === 'km' ? 'km' : 'mi';
    const milesText = task.milesRemaining !== null
      ? task.milesRemaining <= 0
        ? isEstimated ? 'Due' : 'Overdue'
        : `${formatMiles(task.milesRemaining)} ${unit}`
      : null;
    const daysText = task.daysRemaining !== null
      ? task.daysRemaining <= 0
        ? isEstimated ? 'Due' : 'Past due'
        : `${task.daysRemaining}d`
      : null;

    return (
      <Pressable
        key={task.id}
        onPress={() => handleTaskPress(task)}
        style={({ pressed }) => [
          styles.taskItem,
          { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <View style={styles.taskContent}>
          <View style={styles.taskNameRow}>
            <ThemedText type="body" style={styles.taskName}>{task.name}</ThemedText>
            {isEstimated ? (
              <View style={[styles.estimatedBadge, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="info" size={10} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>
                  Est
                </ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {task.vehicleName}
          </ThemedText>
        </View>
        <View style={styles.taskMeta}>
          {milesText !== null ? (
            <ThemedText type="small" style={{ color: statusColor, fontWeight: '600' }}>
              {milesText}
            </ThemedText>
          ) : null}
          {daysText !== null ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {daysText}
            </ThemedText>
          ) : null}
        </View>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </Pressable>
    );
  };

  const renderSection = (title: string, tasks: DashboardTask[], statusColor: string) => {
    if (tasks.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: statusColor }]} />
          <ThemedText type="h4">{title}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {tasks.length}
          </ThemedText>
        </View>
        <View style={styles.taskList}>
          {tasks.map((task) => renderTask(task, statusColor))}
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="check-circle" size={48} color={isDark ? Colors.dark.success : Colors.light.success} />
      </View>
      {vehicles.length === 0 ? (
        <>
          <ThemedText type="h3" style={styles.emptyTitle}>No Vehicles Yet</ThemedText>
          <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Add your first vehicle to start tracking maintenance
          </ThemedText>
          <Pressable
            onPress={() => navigation.navigate('AddVehicle')}
            style={[styles.addButton, { backgroundColor: theme.primary }]}
          >
            <Feather name="plus" size={20} color="#FFFFFF" />
            <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
              Add Vehicle
            </ThemedText>
          </Pressable>
        </>
      ) : (
        <>
          <ThemedText type="h3" style={styles.emptyTitle}>All Caught Up</ThemedText>
          <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            No maintenance items are due soon
          </ThemedText>
        </>
      )}
    </View>
  );

  const hasContent = overdueTasks.length > 0 || dueSoonTasks.length > 0 || upcomingTasks.length > 0;
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <ThemedView style={styles.container}>
      <FlatList
        style={styles.list}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={hasContent ? [1] : []}
        keyExtractor={() => 'content'}
        renderItem={() => (
          <View>
            {showTips && tipOfTheDay ? (
              <Card style={{ ...styles.tipCard, borderLeftColor: theme.primary, borderLeftWidth: 4 }}>
                <View style={styles.tipHeader}>
                  <Feather name="zap" size={16} color={theme.primary} />
                  <ThemedText type="small" style={{ color: theme.primary, fontWeight: '600' }}>
                    TIP OF THE DAY
                  </ThemedText>
                </View>
                <ThemedText type="body" style={{ fontWeight: '600' }}>
                  {tipOfTheDay.title}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                  {tipOfTheDay.tip}
                </ThemedText>
              </Card>
            ) : null}

            {activeVehicle ? (
              <Card style={styles.vehicleCard}>
                <View style={styles.vehicleInfo}>
                  <View style={[styles.vehicleIcon, { backgroundColor: theme.primary }]}>
                    <Feather name="truck" size={20} color="#FFFFFF" />
                  </View>
                  <View style={styles.vehicleText}>
                    <ThemedText type="body" style={{ fontWeight: '600' }}>
                      {activeVehicle.nickname || `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {formatMiles(activeVehicle.currentOdometer)} miles
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => navigation.navigate('UpdateOdometer', { vehicleId: activeVehicle.id })}
                    style={[styles.odometerButton, { backgroundColor: theme.backgroundDefault }]}
                  >
                    <Feather name="edit-2" size={16} color={theme.primary} />
                  </Pressable>
                </View>
              </Card>
            ) : null}
            {renderSection('Overdue', overdueTasks, colors.danger)}
            {renderSection('Due Soon', dueSoonTasks, colors.warning)}
            {renderSection('Next Up', upcomingTasks, colors.success)}
          </View>
        )}
        ListEmptyComponent={renderEmpty}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  tipCard: {
    marginBottom: Spacing.lg,
    paddingLeft: Spacing.lg,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  vehicleCard: {
    marginBottom: Spacing.xl,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  vehicleIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleText: {
    flex: 1,
  },
  odometerButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  taskList: {
    gap: Spacing.sm,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  taskContent: {
    flex: 1,
  },
  taskNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  taskName: {
    fontWeight: '500',
  },
  estimatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  taskMeta: {
    alignItems: 'flex-end',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
});
