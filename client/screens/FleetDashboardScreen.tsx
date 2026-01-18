import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, Pressable, ScrollView, FlatList, Alert, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { useFleet } from '@/context/FleetContext';
import { useData } from '@/context/DataContext';
import { Spacing, BorderRadius } from '@/constants/theme';
import { Vehicle, ServiceLog, FleetMember, DashboardTask } from '@/types';
import { getApiUrl } from '@/lib/query-client';

type TabId = 'overview' | 'vehicles' | 'drivers' | 'logs' | 'costs' | 'reminders';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'bar-chart-2' },
  { id: 'vehicles', label: 'Vehicles', icon: 'truck' },
  { id: 'drivers', label: 'Drivers', icon: 'users' },
  { id: 'logs', label: 'Logs', icon: 'clipboard' },
  { id: 'costs', label: 'Costs', icon: 'dollar-sign' },
  { id: 'reminders', label: 'Alerts', icon: 'bell' },
];

export default function FleetDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { fleet, fleetMembers, isFleetAdmin } = useFleet();
  const { vehicles, serviceLogs, dashboardTasks } = useData();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isExporting, setIsExporting] = useState(false);

  const fleetVehicles = useMemo(() => 
    vehicles.filter(v => v.fleetId === fleet?.id),
    [vehicles, fleet?.id]
  );

  const fleetLogs = useMemo(() => 
    serviceLogs.filter(l => l.fleetId === fleet?.id),
    [serviceLogs, fleet?.id]
  );

  const fleetTasks = useMemo(() => 
    dashboardTasks.filter(t => t.fleetId === fleet?.id),
    [dashboardTasks, fleet?.id]
  );

  const handleExportToSheets = useCallback(async () => {
    if (!fleet || !isFleetAdmin) return;

    setIsExporting(true);
    try {
      const now = Date.now();
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();

      const monthlyLogs = fleetLogs.filter(l => l.date >= thisMonth.getTime());
      const monthlyCost = monthlyLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
      const ytdLogs = fleetLogs.filter(l => l.date >= startOfYear);
      const ytdCost = ytdLogs.reduce((sum, l) => sum + (l.cost || 0), 0);

      const categoryBreakdown: Record<string, number> = {};
      ytdLogs.forEach(log => {
        const cat = log.category || 'Other';
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (log.cost || 0);
      });

      const exportData = {
        fleetName: fleet.name,
        vehicles: fleetVehicles.map(v => {
          const member = fleetMembers.find(m => m.userId === v.userId);
          return {
            name: v.nickname,
            year: v.year,
            make: v.make,
            model: v.model,
            vin: v.vin || '',
            type: v.vehicleType,
            odometer: v.currentOdometer,
            odometerUnit: v.odometerUnit || 'mi',
            isActive: v.isActive !== false,
            assignedDriver: member?.displayName || member?.email || '',
            lastUpdated: v.lastOdometerUpdate ? new Date(v.lastOdometerUpdate).toLocaleDateString() : ''
          };
        }),
        serviceLogs: fleetLogs.map(l => {
          const vehicle = fleetVehicles.find(v => v.id === l.vehicleId);
          return {
            vehicleName: vehicle?.nickname || 'Unknown',
            serviceType: l.taskName,
            date: new Date(l.date).toLocaleDateString(),
            odometer: l.odometer,
            odometerUnit: vehicle?.odometerUnit || 'mi',
            cost: l.cost || 0,
            vendor: '',
            notes: l.notes || '',
            category: l.category || ''
          };
        }),
        members: fleetMembers.map(m => ({
          name: m.displayName || '',
          email: m.email || '',
          role: m.role === 'admin' ? 'Admin' : 'Driver',
          joinedAt: m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '',
          assignedVehicles: fleetVehicles.filter(v => v.userId === m.userId).length
        })),
        costSummary: {
          monthlyTotal: monthlyCost,
          ytdTotal: ytdCost,
          categoryBreakdown
        }
      };

      const response = await fetch(new URL('/api/fleet/export-to-sheets', getApiUrl()).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportData)
      });

      const result = await response.json();

      if (result.success && result.url) {
        Alert.alert(
          'Export Complete',
          'Your fleet data has been exported to Google Sheets.',
          [
            { text: 'Open Spreadsheet', onPress: () => Linking.openURL(result.url) },
            { text: 'OK', style: 'cancel' }
          ]
        );
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error: any) {
      Alert.alert('Export Failed', error.message || 'Could not export to Google Sheets. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [fleet, isFleetAdmin, fleetVehicles, fleetLogs, fleetMembers]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab vehicles={fleetVehicles} logs={fleetLogs} members={fleetMembers} tasks={fleetTasks} />;
      case 'vehicles':
        return <VehiclesTab vehicles={fleetVehicles} members={fleetMembers} />;
      case 'drivers':
        return <DriversTab members={fleetMembers} vehicles={fleetVehicles} />;
      case 'logs':
        return <MaintenanceLogsTab logs={fleetLogs} vehicles={fleetVehicles} />;
      case 'costs':
        return <CostsTab logs={fleetLogs} vehicles={fleetVehicles} />;
      case 'reminders':
        return <RemindersTab tasks={fleetTasks} vehicles={fleetVehicles} />;
      default:
        return null;
    }
  };

  if (!fleet) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.emptyState, { paddingTop: headerHeight + Spacing.xl }]}>
          <Feather name="briefcase" size={48} color={theme.textSecondary} />
          <ThemedText type="h3" style={{ marginTop: Spacing.lg, textAlign: 'center' }}>
            No Fleet Found
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.sm }}>
            You need to create or join a fleet to access the Fleet Dashboard.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: headerHeight + Spacing.md }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <ThemedText type="h2">{fleet.name}</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Fleet Dashboard
            </ThemedText>
          </View>
          {isFleetAdmin && (
            <Pressable
              style={({ pressed }) => [
                styles.exportButton,
                { 
                  backgroundColor: theme.primary,
                  opacity: pressed || isExporting ? 0.7 : 1 
                }
              ]}
              onPress={handleExportToSheets}
              disabled={isExporting}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="upload" size={16} color="#fff" />
                  <ThemedText type="small" style={{ color: '#fff', marginLeft: Spacing.xs }}>
                    Export
                  </ThemedText>
                </>
              )}
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(tab => (
          <Pressable
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && { backgroundColor: theme.primary },
              { borderColor: theme.border }
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Feather 
              name={tab.icon as any} 
              size={16} 
              color={activeTab === tab.id ? '#fff' : theme.text} 
            />
            <ThemedText 
              type="small" 
              style={{ 
                marginLeft: Spacing.xs,
                color: activeTab === tab.id ? '#fff' : theme.text 
              }}
            >
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        {renderTabContent()}
      </View>
    </ThemedView>
  );
}

function OverviewTab({ vehicles, logs, members, tasks }: { 
  vehicles: Vehicle[]; 
  logs: ServiceLog[]; 
  members: FleetMember[];
  tasks: DashboardTask[];
}) {
  const { theme } = useTheme();

  const stats = useMemo(() => {
    const now = Date.now();
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();

    const activeVehicles = vehicles.filter(v => v.isActive).length;
    const overdueCount = tasks.filter(t => t.status === 'overdue').length;
    
    const monthlyLogs = logs.filter(l => l.date >= thisMonth.getTime());
    const monthlyCost = monthlyLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
    
    const ytdLogs = logs.filter(l => l.date >= startOfYear);
    const ytdCost = ytdLogs.reduce((sum, l) => sum + (l.cost || 0), 0);

    const avgCostPerVehicle = vehicles.length > 0 ? ytdCost / vehicles.length : 0;

    const vehicleCosts = vehicles.map(v => ({
      vehicle: v,
      cost: ytdLogs.filter(l => l.vehicleId === v.id).reduce((sum, l) => sum + (l.cost || 0), 0)
    })).sort((a, b) => b.cost - a.cost);

    const mostExpensive = vehicleCosts[0];

    return {
      totalVehicles: vehicles.length,
      activeVehicles,
      overdueCount,
      monthlyCost,
      ytdCost,
      avgCostPerVehicle,
      mostExpensive,
      lastUpdated: new Date().toLocaleString(),
    };
  }, [vehicles, logs, tasks]);

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentContainer}>
      <View style={styles.statsGrid}>
        <StatCard title="Total Vehicles" value={stats.totalVehicles.toString()} icon="truck" />
        <StatCard title="Active Vehicles" value={stats.activeVehicles.toString()} icon="check-circle" />
        <StatCard title="Overdue Services" value={stats.overdueCount.toString()} icon="alert-circle" variant={stats.overdueCount > 0 ? 'danger' : 'default'} />
        <StatCard title="Monthly Cost" value={`$${stats.monthlyCost.toFixed(2)}`} icon="calendar" />
        <StatCard title="YTD Cost" value={`$${stats.ytdCost.toFixed(2)}`} icon="trending-up" />
        <StatCard title="Avg Cost/Vehicle" value={`$${stats.avgCostPerVehicle.toFixed(2)}`} icon="bar-chart" />
      </View>

      {stats.mostExpensive && stats.mostExpensive.cost > 0 ? (
        <Card style={styles.highlightCard}>
          <View style={styles.highlightHeader}>
            <Feather name="alert-triangle" size={20} color={theme.accent} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Most Expensive Vehicle (YTD)</ThemedText>
          </View>
          <ThemedText type="body" style={{ marginTop: Spacing.sm }}>
            {stats.mostExpensive.vehicle.nickname}
          </ThemedText>
          <ThemedText type="h3" style={{ color: theme.accent, marginTop: Spacing.xs }}>
            ${stats.mostExpensive.cost.toFixed(2)}
          </ThemedText>
        </Card>
      ) : null}

      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.lg, textAlign: 'center' }}>
        Last updated: {stats.lastUpdated}
      </ThemedText>
    </ScrollView>
  );
}

function StatCard({ title, value, icon, variant = 'default' }: { 
  title: string; 
  value: string; 
  icon: string;
  variant?: 'default' | 'danger';
}) {
  const { theme } = useTheme();
  const iconColor = variant === 'danger' ? theme.danger : theme.primary;

  return (
    <Card style={styles.statCard}>
      <Feather name={icon as any} size={24} color={iconColor} />
      <ThemedText type="h3" style={{ marginTop: Spacing.sm }}>{value}</ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>{title}</ThemedText>
    </Card>
  );
}

function VehiclesTab({ vehicles, members }: { vehicles: Vehicle[]; members: FleetMember[] }) {
  const { theme } = useTheme();

  const getDriverName = (vehicle: Vehicle) => {
    if (!vehicle.assignedDriverIds?.length) return 'Unassigned';
    const driver = members.find(m => vehicle.assignedDriverIds?.includes(m.userId));
    return driver?.displayName || 'Unknown';
  };

  const getLastServiceDate = (vehicle: Vehicle) => {
    return vehicle.updatedAt ? new Date(vehicle.updatedAt).toLocaleDateString() : 'N/A';
  };

  const renderVehicle = ({ item }: { item: Vehicle }) => (
    <Card style={styles.listCard}>
      <View style={styles.listCardHeader}>
        <Feather 
          name={item.vehicleType === 'semi' ? 'truck' : item.vehicleType === 'pickup' ? 'truck' : 'navigation'} 
          size={20} 
          color={theme.primary} 
        />
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <ThemedText type="h4">{item.nickname}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {item.year} {item.make} {item.model}
          </ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.isActive ? theme.success + '20' : theme.textSecondary + '20' }]}>
          <ThemedText type="small" style={{ color: item.isActive ? theme.success : theme.textSecondary }}>
            {item.isActive ? 'Active' : 'Inactive'}
          </ThemedText>
        </View>
      </View>
      <View style={[styles.listCardDetails, { borderTopColor: theme.border }]}>
        <View style={styles.detailItem}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>VIN</ThemedText>
          <ThemedText type="small">{item.vin || 'N/A'}</ThemedText>
        </View>
        <View style={styles.detailItem}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Odometer</ThemedText>
          <ThemedText type="small">{item.currentOdometer.toLocaleString()} {item.odometerUnit}</ThemedText>
        </View>
        <View style={styles.detailItem}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Driver</ThemedText>
          <ThemedText type="small">{getDriverName(item)}</ThemedText>
        </View>
        <View style={styles.detailItem}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Last Updated</ThemedText>
          <ThemedText type="small">{getLastServiceDate(item)}</ThemedText>
        </View>
      </View>
    </Card>
  );

  return (
    <FlatList
      data={vehicles}
      renderItem={renderVehicle}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.tabContentContainer}
      ListEmptyComponent={
        <View style={styles.emptyList}>
          <Feather name="truck" size={40} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            No vehicles in fleet
          </ThemedText>
        </View>
      }
    />
  );
}

function DriversTab({ members, vehicles }: { members: FleetMember[]; vehicles: Vehicle[] }) {
  const { theme } = useTheme();

  const getAssignedVehicles = (member: FleetMember) => {
    const assigned = vehicles.filter(v => v.assignedDriverIds?.includes(member.userId));
    return assigned.map(v => v.nickname).join(', ') || 'None';
  };

  const renderMember = ({ item }: { item: FleetMember }) => (
    <Card style={styles.listCard}>
      <View style={styles.listCardHeader}>
        <View style={[styles.avatarCircle, { backgroundColor: theme.primary + '20' }]}>
          <ThemedText type="h4" style={{ color: theme.primary }}>
            {(item.displayName || 'U').charAt(0).toUpperCase()}
          </ThemedText>
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <ThemedText type="h4">{item.displayName || 'Unknown'}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {item.email || 'No email'}
          </ThemedText>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: item.role === 'admin' ? theme.primary + '20' : theme.accent + '20' }]}>
          <ThemedText type="small" style={{ color: item.role === 'admin' ? theme.primary : theme.accent }}>
            {item.role === 'admin' ? 'Admin' : 'Driver'}
          </ThemedText>
        </View>
      </View>
      <View style={[styles.listCardDetails, { borderTopColor: theme.border }]}>
        <View style={styles.detailItem}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Assigned Vehicles</ThemedText>
          <ThemedText type="small">{getAssignedVehicles(item)}</ThemedText>
        </View>
        <View style={styles.detailItem}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Joined</ThemedText>
          <ThemedText type="small">{new Date(item.createdAt).toLocaleDateString()}</ThemedText>
        </View>
      </View>
    </Card>
  );

  return (
    <FlatList
      data={members}
      renderItem={renderMember}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.tabContentContainer}
      ListEmptyComponent={
        <View style={styles.emptyList}>
          <Feather name="users" size={40} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            No members in fleet
          </ThemedText>
        </View>
      }
    />
  );
}

function MaintenanceLogsTab({ logs, vehicles }: { logs: ServiceLog[]; vehicles: Vehicle[] }) {
  const { theme } = useTheme();

  const getVehicleName = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle?.nickname || 'Unknown Vehicle';
  };

  const sortedLogs = useMemo(() => 
    [...logs].sort((a, b) => b.date - a.date),
    [logs]
  );

  const renderLog = ({ item }: { item: ServiceLog }) => (
    <Card style={styles.listCard}>
      <View style={styles.listCardHeader}>
        <Feather name="tool" size={20} color={theme.primary} />
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <ThemedText type="h4">{item.taskName}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {getVehicleName(item.vehicleId)}
          </ThemedText>
        </View>
        {item.cost ? (
          <ThemedText type="h4" style={{ color: theme.accent }}>
            ${item.cost.toFixed(2)}
          </ThemedText>
        ) : null}
      </View>
      <View style={[styles.listCardDetails, { borderTopColor: theme.border }]}>
        <View style={styles.detailItem}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Date</ThemedText>
          <ThemedText type="small">{new Date(item.date).toLocaleDateString()}</ThemedText>
        </View>
        <View style={styles.detailItem}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Odometer</ThemedText>
          <ThemedText type="small">{item.odometer.toLocaleString()}</ThemedText>
        </View>
        <View style={styles.detailItem}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Category</ThemedText>
          <ThemedText type="small">{item.category || 'General'}</ThemedText>
        </View>
        {item.notes ? (
          <View style={[styles.detailItem, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Notes</ThemedText>
            <ThemedText type="small">{item.notes}</ThemedText>
          </View>
        ) : null}
      </View>
    </Card>
  );

  return (
    <FlatList
      data={sortedLogs}
      renderItem={renderLog}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.tabContentContainer}
      ListEmptyComponent={
        <View style={styles.emptyList}>
          <Feather name="clipboard" size={40} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            No maintenance logs yet
          </ThemedText>
        </View>
      }
    />
  );
}

function CostsTab({ logs, vehicles }: { logs: ServiceLog[]; vehicles: Vehicle[] }) {
  const { theme } = useTheme();

  const costData = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    const monthlyLogs = logs.filter(l => l.date >= startOfMonth);
    const ytdLogs = logs.filter(l => l.date >= startOfYear);

    const monthlyTotal = monthlyLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
    const ytdTotal = ytdLogs.reduce((sum, l) => sum + (l.cost || 0), 0);

    const categoryBreakdown: Record<string, number> = {};
    ytdLogs.forEach(log => {
      const cat = log.category || 'General';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (log.cost || 0);
    });

    const sortedCategories = Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([category, cost]) => ({ category, cost }));

    const vehicleCosts = vehicles.map(v => {
      const vLogs = ytdLogs.filter(l => l.vehicleId === v.id);
      const totalMiles = v.currentOdometer;
      const totalCost = vLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
      const costPerMile = totalMiles > 0 ? totalCost / totalMiles : 0;
      return {
        vehicle: v,
        totalCost,
        costPerMile,
      };
    }).sort((a, b) => b.totalCost - a.totalCost);

    return {
      monthlyTotal,
      ytdTotal,
      categories: sortedCategories,
      vehicleCosts,
    };
  }, [logs, vehicles]);

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentContainer}>
      <View style={styles.costSummary}>
        <Card style={styles.costSummaryCard}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Monthly Spend</ThemedText>
          <ThemedText type="h2" style={{ color: theme.primary }}>${costData.monthlyTotal.toFixed(2)}</ThemedText>
        </Card>
        <Card style={styles.costSummaryCard}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>YTD Spend</ThemedText>
          <ThemedText type="h2" style={{ color: theme.accent }}>${costData.ytdTotal.toFixed(2)}</ThemedText>
        </Card>
      </View>

      <ThemedText type="h4" style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}>
        Category Breakdown
      </ThemedText>
      {costData.categories.map(({ category, cost }) => (
        <View key={category} style={[styles.categoryRow, { borderBottomColor: theme.border }]}>
          <ThemedText type="body">{category}</ThemedText>
          <ThemedText type="body" style={{ fontWeight: '600' }}>${cost.toFixed(2)}</ThemedText>
        </View>
      ))}

      <ThemedText type="h4" style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}>
        Cost Per Vehicle
      </ThemedText>
      {costData.vehicleCosts.map(({ vehicle, totalCost, costPerMile }) => (
        <Card key={vehicle.id} style={styles.vehicleCostCard}>
          <View style={styles.vehicleCostHeader}>
            <ThemedText type="h4">{vehicle.nickname}</ThemedText>
            <ThemedText type="h4" style={{ color: theme.accent }}>${totalCost.toFixed(2)}</ThemedText>
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Cost per {vehicle.odometerUnit}: ${costPerMile.toFixed(4)}
          </ThemedText>
        </Card>
      ))}
    </ScrollView>
  );
}

function RemindersTab({ tasks, vehicles }: { tasks: DashboardTask[]; vehicles: Vehicle[] }) {
  const { theme } = useTheme();

  const sortedTasks = useMemo(() => {
    const overdue = tasks.filter(t => t.status === 'overdue');
    const dueSoon = tasks.filter(t => t.status === 'dueSoon');
    const upcoming = tasks.filter(t => t.status === 'upcoming');
    return [...overdue, ...dueSoon, ...upcoming];
  }, [tasks]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'overdue': return theme.danger;
      case 'dueSoon': return theme.accent;
      default: return theme.success;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'overdue': return 'Overdue';
      case 'dueSoon': return 'Due Soon';
      default: return 'Upcoming';
    }
  };

  const renderTask = ({ item }: { item: DashboardTask }) => (
    <Card style={styles.listCard}>
      <View style={styles.listCardHeader}>
        <Feather 
          name={item.status === 'overdue' ? 'alert-circle' : item.status === 'dueSoon' ? 'clock' : 'calendar'} 
          size={20} 
          color={getStatusColor(item.status)} 
        />
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <ThemedText type="h4">{item.name}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {item.vehicleName}
          </ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <ThemedText type="small" style={{ color: getStatusColor(item.status) }}>
            {getStatusLabel(item.status)}
          </ThemedText>
        </View>
      </View>
      <View style={[styles.listCardDetails, { borderTopColor: theme.border }]}>
        <View style={styles.detailItem}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Miles/Km Remaining</ThemedText>
          <ThemedText type="small">
            {item.milesRemaining !== null ? item.milesRemaining.toLocaleString() : 'N/A'}
          </ThemedText>
        </View>
        <View style={styles.detailItem}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Days Remaining</ThemedText>
          <ThemedText type="small">
            {item.daysRemaining !== null ? item.daysRemaining : 'N/A'}
          </ThemedText>
        </View>
        <View style={styles.detailItem}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Due Date</ThemedText>
          <ThemedText type="small">
            {item.nextDueDate ? new Date(item.nextDueDate).toLocaleDateString() : 'N/A'}
          </ThemedText>
        </View>
      </View>
    </Card>
  );

  const overdueCount = tasks.filter(t => t.status === 'overdue').length;
  const dueSoonCount = tasks.filter(t => t.status === 'dueSoon').length;

  return (
    <FlatList
      data={sortedTasks}
      renderItem={renderTask}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.tabContentContainer}
      ListHeaderComponent={
        <View style={styles.alertSummary}>
          <View style={[styles.alertBadge, { backgroundColor: theme.danger + '20' }]}>
            <Feather name="alert-circle" size={16} color={theme.danger} />
            <ThemedText type="body" style={{ color: theme.danger, marginLeft: Spacing.xs }}>
              {overdueCount} Overdue
            </ThemedText>
          </View>
          <View style={[styles.alertBadge, { backgroundColor: theme.accent + '20' }]}>
            <Feather name="clock" size={16} color={theme.accent} />
            <ThemedText type="body" style={{ color: theme.accent, marginLeft: Spacing.xs }}>
              {dueSoonCount} Due Soon
            </ThemedText>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyList}>
          <Feather name="check-circle" size={40} color={theme.success} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            No maintenance reminders
          </ThemedText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    minWidth: 80,
    justifyContent: 'center',
  },
  tabBar: {
    flexGrow: 0,
    borderBottomWidth: 1,
  },
  tabBarContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  tabContent: {
    flex: 1,
  },
  tabContentContainer: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyList: {
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statCard: {
    width: '47%',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  highlightCard: {
    marginTop: Spacing.lg,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listCard: {
    marginBottom: Spacing.sm,
  },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listCardDetails: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  roleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  costSummary: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  costSummaryCard: {
    flex: 1,
    alignItems: 'center',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  vehicleCostCard: {
    marginBottom: Spacing.sm,
  },
  vehicleCostHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  alertSummary: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
});
