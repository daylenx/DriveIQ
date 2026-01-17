import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { useData } from '@/context/DataContext';
import { Spacing, BorderRadius } from '@/constants/theme';
import { MaintenanceStackParamList } from '@/navigation/MaintenanceStackNavigator';
import { formatMiles } from '@/lib/storage';

type RouteProps = RouteProp<MaintenanceStackParamList, 'TaskDetail'>;
type NavProp = NativeStackNavigationProp<MaintenanceStackParamList>;

export default function TaskDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { vehicles, serviceLogs } = useData();

  const task = route.params.task;
  const vehicle = task ? vehicles.find((v) => v.id === task.vehicleId) : null;

  const taskLogs = serviceLogs
    .filter((log) => log.taskId === task?.id)
    .sort((a, b) => b.date - a.date)
    .slice(0, 3);

  if (!task) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Task not found</ThemedText>
      </ThemedView>
    );
  }

  const handleLogService = () => {
    navigation.navigate('LogMaintenance', { task });
  };

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.scrollContent}>
          <Card style={styles.taskInfo}>
            <ThemedText type="h3">{task.name}</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
              {task.description}
            </ThemedText>
            {vehicle ? (
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                Vehicle: {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              </ThemedText>
            ) : null}
          </Card>

          <Card style={styles.intervalCard}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Service Interval
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
              Service is due when either condition is met (whichever comes first)
            </ThemedText>
            
            <View style={styles.intervalRow}>
              <View style={[styles.intervalItem, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="navigation" size={20} color={theme.primary} />
                <View>
                  <ThemedText type="h4">{formatMiles(task.milesInterval)}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {vehicle?.odometerUnit === 'km' ? 'km' : 'miles'}
                  </ThemedText>
                </View>
              </View>
              
              <View style={[styles.intervalItem, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="calendar" size={20} color={theme.primary} />
                <View>
                  <ThemedText type="h4">{task.monthsInterval}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>months</ThemedText>
                </View>
              </View>
            </View>
          </Card>

          {taskLogs.length > 0 ? (
            <Card style={styles.historyCard}>
              <ThemedText type="h4" style={styles.sectionTitle}>
                Recent History
              </ThemedText>
              {taskLogs.map((log) => (
                <View key={log.id} style={[styles.historyItem, { borderBottomColor: theme.border }]}>
                  <View>
                    <ThemedText type="body">
                      {new Date(log.date).toLocaleDateString()}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {formatMiles(log.odometer)} {vehicle?.odometerUnit === 'km' ? 'km' : 'mi'}
                    </ThemedText>
                  </View>
                  {log.cost ? (
                    <ThemedText type="body" style={{ color: theme.primary }}>
                      ${log.cost.toFixed(2)}
                    </ThemedText>
                  ) : null}
                </View>
              ))}
            </Card>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={handleLogService}
            style={[styles.logButton, { backgroundColor: theme.primary }]}
          >
            <Feather name="check-circle" size={20} color={theme.buttonText} />
            <ThemedText style={[styles.logButtonText, { color: theme.buttonText }]}>
              Mark Service Complete
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  scrollContent: {
    flex: 1,
    gap: Spacing.lg,
  },
  taskInfo: {
    padding: Spacing.lg,
  },
  intervalCard: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  intervalRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  intervalItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  historyCard: {
    padding: Spacing.lg,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  footer: {
    paddingTop: Spacing.lg,
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  logButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
