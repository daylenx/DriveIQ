import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HeaderButton } from '@react-navigation/elements';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { useData } from '@/context/DataContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Spacing, BorderRadius } from '@/constants/theme';
import { RootStackParamList } from '@/navigation/RootStackNavigator';
import { formatMiles } from '@/lib/storage';
import { ODOMETER_JUMP_THRESHOLD } from '@/lib/units';

type RouteProps = RouteProp<RootStackParamList, 'UpdateOdometer'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function UpdateOdometerModal() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { vehicles, updateOdometer } = useData();
  const { canUpdateOdometer } = usePermissions();

  const vehicle = vehicles.find((v) => v.id === route.params.vehicleId);
  const [odometer, setOdometer] = useState(vehicle?.currentOdometer.toString() || '');
  const [isLoading, setIsLoading] = useState(false);

  const newOdometer = parseInt(odometer.replace(/,/g, ''), 10);
  const hasPermission = vehicle ? canUpdateOdometer(vehicle.id) : false;
  const isValid = !isNaN(newOdometer) && newOdometer > 0 && hasPermission;
  const hasChanged = vehicle && newOdometer !== vehicle.currentOdometer;

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton onPress={() => navigation.goBack()}>
          <ThemedText type="body" style={{ color: theme.primary }}>Cancel</ThemedText>
        </HeaderButton>
      ),
      headerRight: () => (
        <HeaderButton onPress={handleSave} disabled={!isValid || !hasChanged || isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <ThemedText
              type="body"
              style={{
                color: isValid && hasChanged ? theme.primary : theme.textSecondary,
                fontWeight: '600',
              }}
            >
              Save
            </ThemedText>
          )}
        </HeaderButton>
      ),
    });
  }, [odometer, isLoading, isValid, hasChanged]);

  if (!vehicle) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Vehicle not found</ThemedText>
      </ThemedView>
    );
  }

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert('Error', 'Please enter a valid odometer reading');
      return;
    }

    const unit = vehicle.odometerUnit || 'mi';
    const unitLabel = unit === 'mi' ? 'miles' : 'km';

    if (newOdometer < vehicle.currentOdometer) {
      Alert.alert(
        'Lower Reading Detected',
        `This reading (${formatMiles(newOdometer)} ${unitLabel}) is lower than the current reading (${formatMiles(vehicle.currentOdometer)} ${unitLabel}). This might be a typo. Save anyway?`,
        [
          { text: 'Edit', style: 'cancel' },
          { text: 'Save Anyway', onPress: saveOdometer },
        ]
      );
      return;
    }

    const jump = newOdometer - vehicle.currentOdometer;
    if (jump > ODOMETER_JUMP_THRESHOLD) {
      Alert.alert(
        'Large Jump Detected',
        `This is a jump of ${formatMiles(jump)} ${unitLabel} since your last update. This might be a typo. Save anyway?`,
        [
          { text: 'Edit', style: 'cancel' },
          { text: 'Save Anyway', onPress: saveOdometer },
        ]
      );
      return;
    }

    await saveOdometer();
  };

  const saveOdometer = async () => {
    setIsLoading(true);
    try {
      await updateOdometer(vehicle.id, newOdometer);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update odometer');
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundDefault,
      color: theme.text,
      borderColor: theme.border,
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
      >
        <Card style={styles.vehicleCard}>
          <ThemedText type="h3">
            {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Current: {formatMiles(vehicle.currentOdometer)} {vehicle.odometerUnit === 'km' ? 'km' : 'miles'}
          </ThemedText>
        </Card>

        <View style={styles.form}>
          <ThemedText type="h4" style={styles.label}>
            New Odometer Reading
          </ThemedText>
          <ThemedText type="small" style={[styles.hint, { color: theme.textSecondary }]}>
            Update your vehicle's current mileage to recalculate maintenance reminders.
          </ThemedText>

          <View style={styles.inputRow}>
            <TextInput
              style={[inputStyle, styles.inputFlex]}
              placeholder="Enter reading"
              placeholderTextColor={theme.textSecondary}
              value={odometer}
              onChangeText={setOdometer}
              keyboardType="number-pad"
              autoFocus
            />
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {vehicle.odometerUnit === 'km' ? 'km' : 'miles'}
            </ThemedText>
          </View>

          {hasChanged && isValid ? (
            <View style={[styles.previewCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Change: {newOdometer > vehicle.currentOdometer ? '+' : ''}
                {formatMiles(newOdometer - vehicle.currentOdometer)} miles
              </ThemedText>
            </View>
          ) : null}
        </View>
      </KeyboardAwareScrollViewCompat>
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
  vehicleCard: {
    marginBottom: Spacing.xl,
  },
  form: {
    gap: Spacing.md,
  },
  label: {
    marginBottom: Spacing.xs,
  },
  hint: {
    marginBottom: Spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 20,
    fontWeight: '600',
    borderWidth: 1,
  },
  inputFlex: {
    flex: 1,
  },
  previewCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
});
