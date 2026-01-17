import React, { useState } from 'react';
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
import { UpgradeModal } from '@/components/UpgradeModal';
import { useTheme } from '@/hooks/useTheme';
import { useData } from '@/context/DataContext';
import { Spacing, BorderRadius, Colors } from '@/constants/theme';
import { Vehicle, PlanId } from '@/types';
import { RootStackParamList } from '@/navigation/RootStackNavigator';
import { VehiclesStackParamList } from '@/navigation/VehiclesStackNavigator';
import { DEV_PREVIEW_PAYWALL, PAYWALLS_ENABLED } from '@/constants/featureFlags';

type RootNavProp = NativeStackNavigationProp<RootStackParamList>;
type StackNavProp = NativeStackNavigationProp<VehiclesStackParamList>;

export default function VehiclesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const rootNav = useNavigation<RootNavProp>();
  const stackNav = useNavigation<StackNavProp>();
  const { vehicles, activeVehicle, setActiveVehicle, dashboardTasks, canAddVehicle } = useData();

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');
  const [suggestedPlan, setSuggestedPlan] = useState<PlanId | undefined>();

  const handleAddVehicle = () => {
    const result = canAddVehicle();
    if (result.allowed) {
      rootNav.navigate('AddVehicle');
    } else {
      setUpgradeReason(result.reason || 'Vehicle limit reached');
      setSuggestedPlan(result.suggestedPlan);
      setShowUpgradeModal(true);
    }
  };

  const handleContinueAnyway = () => {
    rootNav.navigate('AddVehicle');
  };

  const getVehicleStatus = (vehicleId: string) => {
    const tasks = dashboardTasks.filter((t) => t.vehicleId === vehicleId);
    const overdue = tasks.filter((t) => t.status === 'overdue').length;
    const dueSoon = tasks.filter((t) => t.status === 'dueSoon').length;
    
    if (overdue > 0) return { color: isDark ? Colors.dark.danger : Colors.light.danger, count: overdue, label: 'overdue' };
    if (dueSoon > 0) return { color: isDark ? Colors.dark.warning : Colors.light.warning, count: dueSoon, label: 'due soon' };
    return { color: isDark ? Colors.dark.success : Colors.light.success, count: 0, label: 'up to date' };
  };

  const renderVehicle = ({ item }: { item: Vehicle }) => {
    const status = getVehicleStatus(item.id);
    const isActive = activeVehicle?.id === item.id;
    
    return (
      <Card
        style={[styles.vehicleCard, isActive && { borderWidth: 2, borderColor: theme.primary }]}
        onPress={() => stackNav.navigate('VehicleDetail', { vehicleId: item.id })}
      >
        <View style={styles.vehicleHeader}>
          <View style={[styles.vehicleIcon, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="truck" size={24} color={theme.primary} />
          </View>
          <View style={styles.vehicleInfo}>
            <ThemedText type="h4">
              {item.nickname || `${item.year} ${item.make}`}
            </ThemedText>
            {item.nickname ? (
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {item.year} {item.make} {item.model}
              </ThemedText>
            ) : (
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {item.model} {item.trim || ''}
              </ThemedText>
            )}
          </View>
          {isActive ? (
            <View style={[styles.activeBadge, { backgroundColor: theme.primary }]}>
              <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                Active
              </ThemedText>
            </View>
          ) : (
            <Pressable
              onPress={() => setActiveVehicle(item.id)}
              style={[styles.setActiveButton, { borderColor: theme.border }]}
            >
              <ThemedText type="small" style={{ color: theme.primary }}>
                Set Active
              </ThemedText>
            </Pressable>
          )}
        </View>
        
        <View style={styles.vehicleStats}>
          <View style={styles.stat}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Odometer
            </ThemedText>
            <ThemedText type="body" style={{ fontWeight: '600' }}>
              {item.currentOdometer.toLocaleString()} mi
            </ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Status
            </ThemedText>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: status.color }]} />
              <ThemedText type="body" style={{ fontWeight: '600', color: status.color }}>
                {status.count > 0 ? `${status.count} ${status.label}` : 'Up to date'}
              </ThemedText>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="truck" size={48} color={theme.primary} />
      </View>
      <ThemedText type="h3" style={styles.emptyTitle}>No Vehicles Yet</ThemedText>
      <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Add your first vehicle to start tracking maintenance schedules and service history.
      </ThemedText>
      <Pressable
        onPress={handleAddVehicle}
        style={[styles.emptyButton, { backgroundColor: theme.primary }]}
      >
        <Feather name="plus" size={20} color="#FFFFFF" />
        <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
          Add Your First Vehicle
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        style={styles.list}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing['5xl'],
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={vehicles}
        keyExtractor={(item) => item.id}
        renderItem={renderVehicle}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        ListEmptyComponent={renderEmpty}
      />
      
      <Pressable
        onPress={handleAddVehicle}
        style={[styles.fab, { backgroundColor: theme.primary, bottom: tabBarHeight + Spacing.xl }]}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>

      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason={upgradeReason}
        suggestedPlanId={suggestedPlan}
        onContinueAnyway={DEV_PREVIEW_PAYWALL && !PAYWALLS_ENABLED ? handleContinueAnyway : undefined}
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
  vehicleCard: {
    padding: Spacing.lg,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleInfo: {
    flex: 1,
  },
  activeBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  setActiveButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  vehicleStats: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  stat: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
