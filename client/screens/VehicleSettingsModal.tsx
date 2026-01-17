import React, { useState, useLayoutEffect } from 'react';
import { View, StyleSheet, Pressable, Alert, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight, HeaderButton } from '@react-navigation/elements';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { useData } from '@/context/DataContext';
import { Spacing, BorderRadius } from '@/constants/theme';
import { RootStackParamList } from '@/navigation/RootStackNavigator';
import { OdometerUnit } from '@/types';
import { convertOdometer, getUnitLabel } from '@/lib/units';
import { formatMiles } from '@/lib/storage';

type RouteProps = RouteProp<RootStackParamList, 'VehicleSettings'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function VehicleSettingsModal() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { vehicles, updateVehicle, maintenanceTasks, serviceLogs } = useData();

  const vehicle = vehicles.find((v) => v.id === route.params.vehicleId);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<OdometerUnit>(vehicle?.odometerUnit || 'mi');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton onPress={() => navigation.goBack()}>
          <ThemedText type="body" style={{ color: theme.primary }}>Cancel</ThemedText>
        </HeaderButton>
      ),
      headerRight: () => (
        <HeaderButton onPress={handleSave} disabled={isLoading || selectedUnit === (vehicle?.odometerUnit || 'mi')}>
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <ThemedText
              type="body"
              style={{
                color: selectedUnit !== (vehicle?.odometerUnit || 'mi') ? theme.primary : theme.textSecondary,
                fontWeight: '600',
              }}
            >
              Save
            </ThemedText>
          )}
        </HeaderButton>
      ),
    });
  }, [selectedUnit, isLoading, vehicle]);

  if (!vehicle) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Vehicle not found</ThemedText>
      </ThemedView>
    );
  }

  const currentUnit = vehicle.odometerUnit || 'mi';
  const isUnitChanged = selectedUnit !== currentUnit;
  const convertedOdometer = isUnitChanged
    ? convertOdometer(vehicle.currentOdometer, currentUnit, selectedUnit)
    : vehicle.currentOdometer;

  const handleSave = async () => {
    if (!isUnitChanged) return;

    Alert.alert(
      'Convert Odometer Readings',
      `This will convert your odometer from ${getUnitLabel(currentUnit)} to ${getUnitLabel(selectedUnit)}.\n\nCurrent: ${formatMiles(vehicle.currentOdometer)} ${currentUnit}\nNew: ${formatMiles(convertedOdometer)} ${selectedUnit}\n\nMaintenance intervals will also be adjusted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Convert', onPress: performConversion },
      ]
    );
  };

  const performConversion = async () => {
    setIsLoading(true);
    try {
      const batch = writeBatch(db);

      const updatedVehicle = {
        ...vehicle,
        odometerUnit: selectedUnit,
        currentOdometer: convertedOdometer,
        updatedAt: Date.now(),
      };
      batch.set(doc(db, 'vehicles', vehicle.id), updatedVehicle);

      const vehicleTasks = maintenanceTasks.filter((t) => t.vehicleId === vehicle.id);
      for (const task of vehicleTasks) {
        const updates: Record<string, number | null> = {};
        if (task.lastServiceOdometer !== null && task.lastServiceOdometer !== undefined) {
          updates.lastServiceOdometer = convertOdometer(task.lastServiceOdometer, currentUnit, selectedUnit);
        }
        if (task.nextDueOdometer !== null && task.nextDueOdometer !== undefined) {
          updates.nextDueOdometer = convertOdometer(task.nextDueOdometer, currentUnit, selectedUnit);
        }
        if (Object.keys(updates).length > 0) {
          batch.update(doc(db, 'maintenanceTasks', task.id), updates);
        }
      }

      const vehicleLogs = serviceLogs.filter((l) => l.vehicleId === vehicle.id);
      for (const log of vehicleLogs) {
        const convertedLogOdometer = convertOdometer(log.odometer, currentUnit, selectedUnit);
        batch.update(doc(db, 'serviceLogs', log.id), { odometer: convertedLogOdometer });
      }

      await batch.commit();
      navigation.goBack();
    } catch (error: any) {
      console.error('Failed to update vehicle unit:', error);
      Alert.alert('Error', error?.message || 'Failed to update vehicle settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.lg,
          },
        ]}
      >
        <Card style={styles.vehicleCard}>
          <ThemedText type="h3">
            {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Current: {formatMiles(vehicle.currentOdometer)} {currentUnit === 'km' ? 'km' : 'miles'}
          </ThemedText>
        </Card>

        <Card style={styles.settingsCard}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Odometer Unit
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
            Changing the unit will convert all existing readings
          </ThemedText>

          <View style={styles.unitOptions}>
            <Pressable
              onPress={() => setSelectedUnit('mi')}
              style={[
                styles.unitOption,
                { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                selectedUnit === 'mi' && { borderColor: theme.primary, backgroundColor: theme.primary + '10' },
              ]}
            >
              <View style={styles.unitHeader}>
                <Feather
                  name={selectedUnit === 'mi' ? 'check-circle' : 'circle'}
                  size={20}
                  color={selectedUnit === 'mi' ? theme.primary : theme.textSecondary}
                />
                <ThemedText type="body" style={{ fontWeight: '600' }}>Miles</ThemedText>
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Standard US measurement
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setSelectedUnit('km')}
              style={[
                styles.unitOption,
                { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                selectedUnit === 'km' && { borderColor: theme.primary, backgroundColor: theme.primary + '10' },
              ]}
            >
              <View style={styles.unitHeader}>
                <Feather
                  name={selectedUnit === 'km' ? 'check-circle' : 'circle'}
                  size={20}
                  color={selectedUnit === 'km' ? theme.primary : theme.textSecondary}
                />
                <ThemedText type="body" style={{ fontWeight: '600' }}>Kilometers</ThemedText>
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Metric measurement
              </ThemedText>
            </Pressable>
          </View>
        </Card>

        {isUnitChanged ? (
          <Card style={StyleSheet.flatten([styles.previewCard, { borderColor: theme.warning }])}>
            <View style={styles.previewHeader}>
              <Feather name="info" size={18} color={theme.warning} />
              <ThemedText type="body" style={{ fontWeight: '600' }}>Preview Conversion</ThemedText>
            </View>
            <View style={styles.conversionRow}>
              <View style={styles.conversionItem}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Current</ThemedText>
                <ThemedText type="body">{formatMiles(vehicle.currentOdometer)} {currentUnit}</ThemedText>
              </View>
              <Feather name="arrow-right" size={20} color={theme.textSecondary} />
              <View style={styles.conversionItem}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>After Conversion</ThemedText>
                <ThemedText type="body" style={{ color: theme.primary }}>
                  {formatMiles(convertedOdometer)} {selectedUnit}
                </ThemedText>
              </View>
            </View>
          </Card>
        ) : null}
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
    gap: Spacing.lg,
  },
  vehicleCard: {
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  settingsCard: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  unitOptions: {
    gap: Spacing.md,
  },
  unitOption: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.xs,
  },
  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  previewCard: {
    padding: Spacing.lg,
    borderWidth: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  conversionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conversionItem: {
    gap: Spacing.xs,
  },
});
