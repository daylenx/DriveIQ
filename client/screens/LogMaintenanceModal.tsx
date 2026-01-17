import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { HeaderButton } from '@react-navigation/elements';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useTheme } from '@/hooks/useTheme';
import { useData } from '@/context/DataContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Spacing, BorderRadius } from '@/constants/theme';
import { MaintenanceTask } from '@/types';
import { formatDate, formatMiles } from '@/lib/storage';

type LogMaintenanceParams = { task?: MaintenanceTask };
type RouteProps = RouteProp<{ LogMaintenance: LogMaintenanceParams }, 'LogMaintenance'>;

export default function LogMaintenanceModal() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { vehicles, maintenanceTasks, activeVehicle, logService } = useData();
  const { canLogService } = usePermissions();

  const preselectedTask = route.params?.task;
  const preselectedVehicle = preselectedTask
    ? vehicles.find((v) => v.id === preselectedTask.vehicleId)
    : activeVehicle;

  const [selectedVehicleId, setSelectedVehicleId] = useState(preselectedVehicle?.id || '');
  const [selectedTaskId, setSelectedTaskId] = useState(preselectedTask?.id || '');
  const [date, setDate] = useState(Date.now());
  const [odometer, setOdometer] = useState(preselectedVehicle?.currentOdometer.toString() || '');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const selectedTask = maintenanceTasks.find((t) => t.id === selectedTaskId);
  const vehicleTasks = maintenanceTasks.filter((t) => t.vehicleId === selectedVehicleId);

  const hasPermission = selectedVehicleId ? canLogService(selectedVehicleId) : false;
  const isValid = selectedVehicleId && selectedTaskId && odometer.trim() && hasPermission;

  useEffect(() => {
    navigation.setOptions({
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
  }, [selectedVehicleId, selectedTaskId, odometer, isLoading, isValid]);

  const handleSave = async () => {
    if (!isValid || !selectedTask) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const odometerNum = parseInt(odometer.replace(/,/g, ''), 10);
    if (isNaN(odometerNum) || odometerNum < 0) {
      Alert.alert('Error', 'Please enter a valid odometer reading');
      return;
    }

    const costNum = cost ? parseFloat(cost.replace(/[$,]/g, '')) : undefined;

    setIsLoading(true);
    try {
      await logService({
        vehicleId: selectedVehicleId,
        taskId: selectedTaskId,
        taskName: selectedTask.name,
        date,
        odometer: odometerNum,
        notes: notes.trim() || undefined,
        cost: costNum,
        receiptUri,
        ownerType: selectedVehicle?.ownerType || 'personal',
        fleetId: selectedVehicle?.fleetId,
      });
      navigation.goBack();
    } catch (error: any) {
      console.error('Failed to log service:', error);
      Alert.alert('Error', error?.message || 'Failed to log service');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickImage = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Photo capture is available in Expo Go');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Photo capture is available in Expo Go');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
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
          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>Vehicle *</ThemedText>
            <Pressable
              onPress={() => setShowVehiclePicker(!showVehiclePicker)}
              style={[inputStyle, styles.picker]}
            >
              <ThemedText type="body" style={{ color: selectedVehicle ? theme.text : theme.textSecondary }}>
                {selectedVehicle
                  ? selectedVehicle.nickname || `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
                  : 'Select vehicle'}
              </ThemedText>
              <Feather name="chevron-down" size={20} color={theme.textSecondary} />
            </Pressable>
            {showVehiclePicker ? (
              <View style={[styles.pickerOptions, { backgroundColor: theme.backgroundSecondary }]}>
                {vehicles.map((vehicle) => (
                  <Pressable
                    key={vehicle.id}
                    onPress={() => {
                      setSelectedVehicleId(vehicle.id);
                      setOdometer(vehicle.currentOdometer.toString());
                      setSelectedTaskId('');
                      setShowVehiclePicker(false);
                    }}
                    style={[
                      styles.pickerOption,
                      selectedVehicleId === vehicle.id && { backgroundColor: theme.backgroundTertiary },
                    ]}
                  >
                    <ThemedText type="body">
                      {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>Maintenance Type *</ThemedText>
            <Pressable
              onPress={() => setShowTaskPicker(!showTaskPicker)}
              style={[inputStyle, styles.picker]}
              disabled={!selectedVehicleId}
            >
              <ThemedText type="body" style={{ color: selectedTask ? theme.text : theme.textSecondary }}>
                {selectedTask?.name || 'Select maintenance type'}
              </ThemedText>
              <Feather name="chevron-down" size={20} color={theme.textSecondary} />
            </Pressable>
            {showTaskPicker ? (
              <View style={[styles.pickerOptions, { backgroundColor: theme.backgroundSecondary }]}>
                {vehicleTasks.map((task) => (
                  <Pressable
                    key={task.id}
                    onPress={() => {
                      setSelectedTaskId(task.id);
                      setShowTaskPicker(false);
                    }}
                    style={[
                      styles.pickerOption,
                      selectedTaskId === task.id && { backgroundColor: theme.backgroundTertiary },
                    ]}
                  >
                    <ThemedText type="body">{task.name}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {task.category}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>Date</ThemedText>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={[inputStyle, styles.dateDisplay]}
            >
              <Feather name="calendar" size={18} color={theme.textSecondary} />
              <ThemedText type="body">{formatDate(date)}</ThemedText>
              <Feather name="chevron-down" size={20} color={theme.textSecondary} />
            </Pressable>
            {showDatePicker && Platform.OS === 'android' ? (
              <DateTimePicker
                value={new Date(date)}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                  setShowDatePicker(false);
                  if (event.type === 'set' && selectedDate) {
                    setDate(selectedDate.getTime());
                  }
                }}
              />
            ) : null}
            {showDatePicker && Platform.OS === 'ios' ? (
              <Modal transparent animationType="slide">
                <View style={styles.datePickerModal}>
                  <View style={[styles.datePickerContainer, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={styles.datePickerHeader}>
                      <Pressable onPress={() => setShowDatePicker(false)}>
                        <ThemedText type="body" style={{ color: theme.primary }}>Cancel</ThemedText>
                      </Pressable>
                      <ThemedText type="body" style={{ fontWeight: '600' }}>Select Date</ThemedText>
                      <Pressable onPress={() => setShowDatePicker(false)}>
                        <ThemedText type="body" style={{ color: theme.primary, fontWeight: '600' }}>Done</ThemedText>
                      </Pressable>
                    </View>
                    <DateTimePicker
                      value={new Date(date)}
                      mode="date"
                      display="spinner"
                      maximumDate={new Date()}
                      textColor={isDark ? '#FFFFFF' : '#000000'}
                      onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                        if (selectedDate) {
                          setDate(selectedDate.getTime());
                        }
                      }}
                      style={{ height: 200 }}
                    />
                  </View>
                </View>
              </Modal>
            ) : null}
            {showDatePicker && Platform.OS === 'web' ? (
              <View style={[styles.pickerOptions, { backgroundColor: theme.backgroundSecondary }]}>
                <input
                  type="date"
                  value={new Date(date).toISOString().split('T')[0]}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value);
                    if (!isNaN(newDate.getTime())) {
                      setDate(newDate.getTime());
                    }
                    setShowDatePicker(false);
                  }}
                  style={{
                    padding: 12,
                    fontSize: 16,
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: theme.text,
                    width: '100%',
                  }}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>
              Odometer Reading ({selectedVehicle?.odometerUnit === 'km' ? 'km' : 'mi'}) *
            </ThemedText>
            <TextInput
              style={inputStyle}
              placeholder={`Current ${selectedVehicle?.odometerUnit === 'km' ? 'odometer' : 'mileage'}`}
              placeholderTextColor={theme.textSecondary}
              value={odometer}
              onChangeText={setOdometer}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>Cost</ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="$ 0.00 (optional)"
              placeholderTextColor={theme.textSecondary}
              value={cost}
              onChangeText={setCost}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>Notes</ThemedText>
            <TextInput
              style={[inputStyle, styles.textArea]}
              placeholder="Additional notes (optional)"
              placeholderTextColor={theme.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="body" style={styles.label}>Receipt Photo</ThemedText>
            <View style={styles.photoButtons}>
              <Pressable
                onPress={handleTakePhoto}
                style={[styles.photoButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
              >
                <Feather name="camera" size={20} color={theme.primary} />
                <ThemedText type="small" style={{ color: theme.primary }}>Camera</ThemedText>
              </Pressable>
              <Pressable
                onPress={handlePickImage}
                style={[styles.photoButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
              >
                <Feather name="image" size={20} color={theme.primary} />
                <ThemedText type="small" style={{ color: theme.primary }}>Gallery</ThemedText>
              </Pressable>
            </View>
            {receiptUri ? (
              <View style={styles.receiptPreview}>
                <Feather name="check-circle" size={16} color={theme.primary} />
                <ThemedText type="small" style={{ color: theme.primary, flex: 1 }}>
                  Photo attached
                </ThemedText>
                <Pressable onPress={() => setReceiptUri(undefined)}>
                  <Feather name="x" size={18} color={theme.textSecondary} />
                </Pressable>
              </View>
            ) : null}
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
  textArea: {
    height: 100,
    paddingTop: Spacing.md,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerOptions: {
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  pickerOption: {
    padding: Spacing.md,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  receiptPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
  },
  datePickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  datePickerContainer: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingBottom: Spacing.xl,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
});
