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
import { Spacing, BorderRadius, Colors } from '@/constants/theme';
import { ServiceLog } from '@/types';
import { formatDate, formatCurrency } from '@/lib/storage';
import { LogsStackParamList } from '@/navigation/LogsStackNavigator';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

type StackNavProp = NativeStackNavigationProp<LogsStackParamList>;
type RootNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function LogsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const stackNav = useNavigation<StackNavProp>();
  const rootNav = useNavigation<RootNavProp>();
  const { serviceLogs, vehicles } = useData();

  const sortedLogs = [...serviceLogs].sort((a, b) => b.date - a.date);

  const getVehicleName = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return 'Unknown';
    return vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  };

  const renderLog = ({ item }: { item: ServiceLog }) => (
    <Card
      style={styles.logCard}
      onPress={() => stackNav.navigate('LogDetail', { logId: item.id })}
    >
      <View style={styles.logHeader}>
        <View style={[styles.logIcon, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="tool" size={20} color={theme.primary} />
        </View>
        <View style={styles.logInfo}>
          <ThemedText type="body" style={{ fontWeight: '600' }}>{item.taskName}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {getVehicleName(item.vehicleId)}
          </ThemedText>
        </View>
        {item.receiptUri ? (
          <Feather name="image" size={18} color={theme.textSecondary} />
        ) : null}
      </View>
      
      <View style={styles.logDetails}>
        <View style={styles.logDetail}>
          <Feather name="calendar" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {formatDate(item.date)}
          </ThemedText>
        </View>
        <View style={styles.logDetail}>
          <Feather name="activity" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {item.odometer.toLocaleString()} mi
          </ThemedText>
        </View>
        {item.cost ? (
          <View style={styles.logDetail}>
            <Feather name="dollar-sign" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {formatCurrency(item.cost)}
            </ThemedText>
          </View>
        ) : null}
      </View>
      
      {item.notes ? (
        <ThemedText type="small" style={[styles.notes, { color: theme.textSecondary }]} numberOfLines={2}>
          {item.notes}
        </ThemedText>
      ) : null}
    </Card>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="file-text" size={48} color={theme.primary} />
      </View>
      <ThemedText type="h3" style={styles.emptyTitle}>No Service Logs</ThemedText>
      <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {vehicles.length === 0
          ? "Add a vehicle first, then log maintenance services to build your vehicle history."
          : "Log your first maintenance service to start building your vehicle history and track expenses."}
      </ThemedText>
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
        data={sortedLogs}
        keyExtractor={(item) => item.id}
        renderItem={renderLog}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        ListEmptyComponent={renderEmpty}
      />

      <Pressable
        onPress={() => rootNav.navigate('LogMaintenance')}
        style={[styles.fab, { backgroundColor: theme.primary, bottom: tabBarHeight + Spacing.xl }]}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>
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
  logCard: {
    padding: Spacing.lg,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logInfo: {
    flex: 1,
  },
  logDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
  },
  logDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  notes: {
    marginTop: Spacing.md,
    fontStyle: 'italic',
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
