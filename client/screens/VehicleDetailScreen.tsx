import React from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { OdometerReminderBanner } from '@/components/OdometerReminderBanner';
import { CostSummaryCard } from '@/components/CostSummaryCard';
import { useTheme } from '@/hooks/useTheme';
import { useData } from '@/context/DataContext';
import { Spacing, BorderRadius, Colors } from '@/constants/theme';
import { VehiclesStackParamList } from '@/navigation/VehiclesStackNavigator';
import { RootStackParamList } from '@/navigation/RootStackNavigator';
import { formatMiles } from '@/lib/storage';

type RouteProps = RouteProp<VehiclesStackParamList, 'VehicleDetail'>;
type StackNavProp = NativeStackNavigationProp<VehiclesStackParamList>;
type RootNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function VehicleDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const stackNav = useNavigation<StackNavProp>();
  const rootNav = useNavigation<RootNavProp>();
  const route = useRoute<RouteProps>();
  const { vehicles, maintenanceTasks, removeVehicle, serviceLogs } = useData();

  const vehicle = vehicles.find((v) => v.id === route.params.vehicleId);
  const vehicleTasks = maintenanceTasks.filter((t) => t.vehicleId === route.params.vehicleId);
  const vehicleLogs = serviceLogs.filter((l) => l.vehicleId === route.params.vehicleId);

  if (!vehicle) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Vehicle not found</ThemedText>
      </ThemedView>
    );
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to delete ${vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}? This will also delete all maintenance records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeVehicle(vehicle.id);
            stackNav.goBack();
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    rootNav.navigate('AddVehicle', { vehicleId: vehicle.id });
  };

  const handleUpdateOdometer = () => {
    rootNav.navigate('UpdateOdometer', { vehicleId: vehicle.id });
  };

  const handleVehicleSettings = () => {
    rootNav.navigate('VehicleSettings', { vehicleId: vehicle.id });
  };

  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <OdometerReminderBanner
          vehicle={vehicle}
          onUpdate={handleUpdateOdometer}
        />
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={[styles.vehicleIcon, { backgroundColor: theme.primary }]}>
              <Feather name="truck" size={32} color="#FFFFFF" />
            </View>
            <View style={styles.headerInfo}>
              <ThemedText type="h2">
                {vehicle.nickname || `${vehicle.year} ${vehicle.make}`}
              </ThemedText>
              {vehicle.nickname ? (
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim || ''}
                </ThemedText>
              ) : (
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  {vehicle.model} {vehicle.trim || ''}
                </ThemedText>
              )}
            </View>
          </View>

          <View style={styles.statsRow}>
            <Pressable onPress={handleUpdateOdometer} style={styles.statItem}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Odometer
              </ThemedText>
              <ThemedText type="h3">{formatMiles(vehicle.currentOdometer)}</ThemedText>
              <View style={styles.editRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {vehicle.odometerUnit === 'km' ? 'km' : 'miles'}
                </ThemedText>
                <Feather name="edit-2" size={12} color={theme.primary} />
              </View>
            </Pressable>
            <View style={styles.statItem}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Service Records
              </ThemedText>
              <ThemedText type="h3">{vehicleLogs.length}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>total</ThemedText>
            </View>
          </View>

          {vehicle.vin ? (
            <View style={styles.vinRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>VIN</ThemedText>
              <ThemedText type="body" style={{ fontFamily: 'monospace' }}>{vehicle.vin}</ThemedText>
            </View>
          ) : null}
        </Card>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Maintenance Schedule</ThemedText>
          {vehicleTasks.map((task) => {
            const now = Date.now();
            const milesRemaining = task.nextDueOdometer ? task.nextDueOdometer - vehicle.currentOdometer : null;
            const daysRemaining = task.nextDueDate ? Math.floor((task.nextDueDate - now) / (24 * 60 * 60 * 1000)) : null;
            
            let statusColor = colors.success;
            if ((milesRemaining !== null && milesRemaining <= 0) || (daysRemaining !== null && daysRemaining <= 0)) {
              statusColor = colors.danger;
            } else if ((milesRemaining !== null && milesRemaining <= 500) || (daysRemaining !== null && daysRemaining <= 14)) {
              statusColor = colors.warning;
            }

            return (
              <Pressable
                key={task.id}
                onPress={() => rootNav.navigate('LogMaintenance', { task })}
                style={({ pressed }) => [
                  styles.taskItem,
                  { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View style={[styles.taskDot, { backgroundColor: statusColor }]} />
                <View style={styles.taskInfo}>
                  <ThemedText type="body" style={{ fontWeight: '500' }}>{task.name}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Every {formatMiles(task.milesInterval)} {vehicle.odometerUnit === 'km' ? 'km' : 'mi'} or {task.monthsInterval} months
                  </ThemedText>
                </View>
                <View style={styles.taskDue}>
                  {milesRemaining !== null ? (
                    <ThemedText type="small" style={{ color: statusColor, fontWeight: '600' }}>
                      {milesRemaining <= 0 ? 'Overdue' : `${formatMiles(milesRemaining)} ${vehicle.odometerUnit === 'km' ? 'km' : 'mi'}`}
                    </ThemedText>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </Pressable>
            );
          })}
        </View>

        <CostSummaryCard
          serviceLogs={vehicleLogs}
          onUpgrade={() => rootNav.navigate('Pricing')}
        />

        <View style={styles.actions}>
          <Pressable
            onPress={handleEdit}
            style={[styles.actionButton, { backgroundColor: theme.backgroundDefault }]}
          >
            <Feather name="edit-2" size={20} color={theme.primary} />
            <ThemedText type="body" style={{ color: theme.primary, fontWeight: '500' }}>
              Edit Vehicle
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleVehicleSettings}
            style={[styles.actionButton, { backgroundColor: theme.backgroundDefault }]}
          >
            <Feather name="settings" size={20} color={theme.primary} />
            <ThemedText type="body" style={{ color: theme.primary, fontWeight: '500' }}>
              Vehicle Settings
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleDelete}
            style={[styles.actionButton, { backgroundColor: theme.backgroundDefault }]}
          >
            <Feather name="trash-2" size={20} color={colors.danger} />
            <ThemedText type="body" style={{ color: colors.danger, fontWeight: '500' }}>
              Delete Vehicle
            </ThemedText>
          </Pressable>
        </View>
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
  headerCard: {
    marginBottom: Spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  vehicleIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  vinRow: {
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  taskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  taskInfo: {
    flex: 1,
  },
  taskDue: {
    alignItems: 'flex-end',
  },
  actions: {
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
});
