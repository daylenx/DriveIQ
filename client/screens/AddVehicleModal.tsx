import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Alert, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HeaderButton } from '@react-navigation/elements';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useTheme } from '@/hooks/useTheme';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useFleet } from '@/context/FleetContext';
import { Spacing, BorderRadius } from '@/constants/theme';
import { PLANS, VEHICLE_TYPE_LABELS, isVehicleTypeAllowed } from '@/constants/plans';
import { RootStackParamList } from '@/navigation/RootStackNavigator';
import { VehicleType, OdometerUnit } from '@/types';

type RouteProps = RouteProp<RootStackParamList, 'AddVehicle'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const VEHICLE_TYPES: { type: VehicleType; icon: string }[] = [
  { type: 'car', icon: 'car-side' },
  { type: 'pickup', icon: 'truck' },
  { type: 'semi', icon: 'truck-trailer' },
];

const ODOMETER_UNITS: { unit: OdometerUnit; label: string }[] = [
  { unit: 'mi', label: 'Miles' },
  { unit: 'km', label: 'Kilometers' },
];

export default function AddVehicleModal() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { vehicles, addVehicle, updateVehicle } = useData();
  const { user } = useAuth();
  const { fleet, isFleetAdmin } = useFleet();

  const existingVehicle = route.params?.vehicleId
    ? vehicles.find((v) => v.id === route.params?.vehicleId)
    : null;

  const currentPlan = user?.plan || 'free';
  const plan = PLANS[currentPlan] || PLANS.free;
  const vehiclesUsed = vehicles.length;
  const vehicleLimit = user?.vehicleLimit || plan.vehicleLimit;

  const [vehicleType, setVehicleType] = useState<VehicleType>(existingVehicle?.vehicleType || 'car');
  const [odometerUnit, setOdometerUnit] = useState<OdometerUnit>(existingVehicle?.odometerUnit || 'mi');
  const [year, setYear] = useState(existingVehicle?.year.toString() || '');
  const [make, setMake] = useState(existingVehicle?.make || '');
  const [model, setModel] = useState(existingVehicle?.model || '');
  const [trim, setTrim] = useState(existingVehicle?.trim || '');
  const [nickname, setNickname] = useState(existingVehicle?.nickname || '');
  const [vin, setVin] = useState(existingVehicle?.vin || '');
  const [odometer, setOdometer] = useState(existingVehicle?.currentOdometer.toString() || '');
  const [isLoading, setIsLoading] = useState(false);

  const isVehicleTypeValid = isVehicleTypeAllowed(currentPlan, vehicleType);
  const isValid = year.trim() && make.trim() && model.trim() && odometer.trim() && isVehicleTypeValid;

  useEffect(() => {
    navigation.setOptions({
      headerTitle: existingVehicle ? 'Edit Vehicle' : 'Add Vehicle',
      headerLeft: () => (
        <HeaderButton onPress={() => navigation.goBack()}>
          <ThemedText type="body" style={{ color: theme.primary }}>Cancel</ThemedText>
        </HeaderButton>
      ),
      headerRight: () => (
        <HeaderButton onPress={handleSave} disabled={!isValid || isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <ThemedText
              type="body"
              style={{ color: isValid ? theme.primary : theme.textSecondary, fontWeight: '600' }}
            >
              Save
            </ThemedText>
          )}
        </HeaderButton>
      ),
    });
  }, [year, make, model, odometer, isLoading, isValid, vehicleType]);

  const handleSave = async () => {
    if (!isValid) {
      if (!isVehicleTypeValid) {
        Alert.alert(
          'Vehicle Type Not Available',
          `Semi-trucks are not available on the ${plan.name} plan. Upgrade to Personal Pro or a Fleet plan to add semi-trucks.`
        );
        return;
      }
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const yearNum = parseInt(year, 10);
    const odometerNum = parseInt(odometer.replace(/,/g, ''), 10);

    if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
      Alert.alert('Error', 'Please enter a valid year');
      return;
    }

    if (isNaN(odometerNum) || odometerNum < 0) {
      Alert.alert('Error', 'Please enter a valid odometer reading');
      return;
    }

    setIsLoading(true);
    try {
      if (existingVehicle) {
        const updatedVehicle = {
          ...existingVehicle,
          vehicleType,
          odometerUnit,
          year: yearNum,
          make: make.trim(),
          model: model.trim(),
          nickname: nickname.trim() || `${yearNum} ${make.trim()} ${model.trim()}`,
          currentOdometer: odometerNum,
        };
        if (trim.trim()) {
          updatedVehicle.trim = trim.trim();
        } else {
          delete updatedVehicle.trim;
        }
        if (vin.trim()) {
          updatedVehicle.vin = vin.trim();
        } else {
          delete updatedVehicle.vin;
        }
        await updateVehicle(updatedVehicle);
      } else {
        const isFleetVehicle = isFleetAdmin && fleet;
        const vehiclePayload: Parameters<typeof addVehicle>[0] = {
          vehicleType,
          odometerUnit,
          year: yearNum,
          make: make.trim(),
          model: model.trim(),
          currentOdometer: odometerNum,
          ownerType: isFleetVehicle ? 'fleet' : 'personal',
          nickname: nickname.trim() || `${yearNum} ${make.trim()} ${model.trim()}`,
        };
        if (trim.trim()) vehiclePayload.trim = trim.trim();
        if (vin.trim()) vehiclePayload.vin = vin.trim();
        if (isFleetVehicle) vehiclePayload.fleetId = fleet.id;
        await addVehicle(vehiclePayload);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save vehicle');
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
        <View style={styles.form}>
          {!existingVehicle ? (
            <View style={[styles.usageInfo, { backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Vehicles: {vehiclesUsed} / {vehicleLimit === Infinity ? 'Unlimited' : vehicleLimit}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>Vehicle Type *</ThemedText>
            <View style={styles.vehicleTypeRow}>
              {VEHICLE_TYPES.map((vt) => {
                const isAllowed = isVehicleTypeAllowed(currentPlan, vt.type);
                const isSelected = vehicleType === vt.type;
                const typeInfo = VEHICLE_TYPE_LABELS[vt.type];
                
                return (
                  <Pressable
                    key={vt.type}
                    onPress={() => isAllowed && setVehicleType(vt.type)}
                    style={[
                      styles.vehicleTypeOption,
                      {
                        backgroundColor: isSelected ? theme.primary + '20' : theme.backgroundDefault,
                        borderColor: isSelected ? theme.primary : theme.border,
                        opacity: isAllowed ? 1 : 0.5,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={vt.icon as any}
                      size={24}
                      color={isSelected ? theme.primary : theme.textSecondary}
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color: isSelected ? theme.primary : theme.text,
                        textAlign: 'center',
                      }}
                    >
                      {typeInfo.label}
                    </ThemedText>
                    {!isAllowed ? (
                      <View style={[styles.lockedBadge, { backgroundColor: theme.backgroundTertiary }]}>
                        <Feather name="lock" size={10} color={theme.textSecondary} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            {!isVehicleTypeValid ? (
              <ThemedText type="small" style={[styles.hint, { color: theme.danger }]}>
                Semi-trucks require Personal Pro or Fleet plan
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>Year *</ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="e.g., 2020"
              placeholderTextColor={theme.textSecondary}
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>Make *</ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="e.g., Toyota"
              placeholderTextColor={theme.textSecondary}
              value={make}
              onChangeText={setMake}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>Model *</ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="e.g., Camry"
              placeholderTextColor={theme.textSecondary}
              value={model}
              onChangeText={setModel}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>Trim</ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="e.g., SE, XLE, Sport (optional)"
              placeholderTextColor={theme.textSecondary}
              value={trim}
              onChangeText={setTrim}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>Nickname</ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="e.g., Family Car (optional)"
              placeholderTextColor={theme.textSecondary}
              value={nickname}
              onChangeText={setNickname}
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>VIN</ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="17-character VIN (optional)"
              placeholderTextColor={theme.textSecondary}
              value={vin}
              onChangeText={setVin}
              autoCapitalize="characters"
              maxLength={17}
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>Odometer Unit *</ThemedText>
            <View style={styles.unitRow}>
              {ODOMETER_UNITS.map((u) => (
                <Pressable
                  key={u.unit}
                  onPress={() => setOdometerUnit(u.unit)}
                  style={[
                    styles.unitOption,
                    {
                      backgroundColor: odometerUnit === u.unit ? theme.primary + '20' : theme.backgroundDefault,
                      borderColor: odometerUnit === u.unit ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    type="body"
                    style={{
                      color: odometerUnit === u.unit ? theme.primary : theme.text,
                      fontWeight: odometerUnit === u.unit ? '600' : '400',
                    }}
                  >
                    {u.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>Current Odometer *</ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="e.g., 50000"
              placeholderTextColor={theme.textSecondary}
              value={odometer}
              onChangeText={setOdometer}
              keyboardType="number-pad"
            />
            <ThemedText type="small" style={[styles.hint, { color: theme.textSecondary }]}>
              Enter current reading in {odometerUnit === 'mi' ? 'miles' : 'kilometers'}
            </ThemedText>
          </View>
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
  form: {
    gap: Spacing.lg,
  },
  usageInfo: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  field: {
    gap: Spacing.xs,
  },
  label: {
    fontWeight: '500',
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    borderWidth: 1,
  },
  hint: {
    marginTop: Spacing.xs,
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  vehicleTypeOption: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    alignItems: 'center',
    gap: Spacing.xs,
    position: 'relative',
  },
  lockedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  unitOption: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    alignItems: 'center',
  },
});
