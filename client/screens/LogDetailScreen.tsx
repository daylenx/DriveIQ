import React from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Image } from 'react-native';
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
import { Spacing, BorderRadius, Colors } from '@/constants/theme';
import { formatDate, formatCurrency } from '@/lib/storage';
import { LogsStackParamList } from '@/navigation/LogsStackNavigator';

type RouteProps = RouteProp<LogsStackParamList, 'LogDetail'>;
type NavProp = NativeStackNavigationProp<LogsStackParamList>;

export default function LogDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { serviceLogs, vehicles, removeServiceLog } = useData();

  const log = serviceLogs.find((l) => l.id === route.params.logId);
  const vehicle = log ? vehicles.find((v) => v.id === log.vehicleId) : null;

  if (!log) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Log not found</ThemedText>
      </ThemedView>
    );
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Service Log',
      'Are you sure you want to delete this service record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeServiceLog(log.id);
            navigation.goBack();
          },
        },
      ]
    );
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
        <Card style={styles.mainCard}>
          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: theme.primary }]}>
              <Feather name="tool" size={28} color="#FFFFFF" />
            </View>
            <ThemedText type="h2">{log.taskName}</ThemedText>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Feather name="calendar" size={18} color={theme.textSecondary} />
              <View>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Date</ThemedText>
                <ThemedText type="body">{formatDate(log.date)}</ThemedText>
              </View>
            </View>
            <View style={styles.detailItem}>
              <Feather name="activity" size={18} color={theme.textSecondary} />
              <View>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Odometer</ThemedText>
                <ThemedText type="body">{log.odometer.toLocaleString()} mi</ThemedText>
              </View>
            </View>
            {log.cost ? (
              <View style={styles.detailItem}>
                <Feather name="dollar-sign" size={18} color={theme.textSecondary} />
                <View>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Cost</ThemedText>
                  <ThemedText type="body">{formatCurrency(log.cost)}</ThemedText>
                </View>
              </View>
            ) : null}
          </View>
        </Card>

        <Card style={styles.vehicleCard}>
          <View style={styles.vehicleRow}>
            <View style={[styles.vehicleIcon, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="truck" size={24} color={theme.primary} />
            </View>
            <View style={styles.vehicleInfo}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Vehicle</ThemedText>
              <ThemedText type="body" style={{ fontWeight: '500' }}>
                {vehicle
                  ? vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`
                  : 'Unknown'}
              </ThemedText>
            </View>
          </View>
        </Card>

        {log.notes ? (
          <Card style={styles.notesCard}>
            <ThemedText type="h4" style={styles.sectionTitle}>Notes</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {log.notes}
            </ThemedText>
          </Card>
        ) : null}

        {log.receiptUri ? (
          <Card style={styles.receiptCard}>
            <ThemedText type="h4" style={styles.sectionTitle}>Receipt</ThemedText>
            <Image
              source={{ uri: log.receiptUri }}
              style={styles.receiptImage}
              resizeMode="cover"
            />
          </Card>
        ) : null}

        <Pressable
          onPress={handleDelete}
          style={[styles.deleteButton, { backgroundColor: theme.backgroundDefault }]}
        >
          <Feather name="trash-2" size={20} color={colors.danger} />
          <ThemedText type="body" style={{ color: colors.danger, fontWeight: '500' }}>
            Delete Service Log
          </ThemedText>
        </Pressable>
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
  mainCard: {
    marginBottom: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  detailsGrid: {
    gap: Spacing.lg,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  vehicleCard: {
    marginBottom: Spacing.lg,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
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
  notesCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  receiptCard: {
    marginBottom: Spacing.xl,
  },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.sm,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
});
