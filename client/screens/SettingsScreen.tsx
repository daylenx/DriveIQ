import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Switch, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useFleet } from '@/context/FleetContext';
import { Spacing, BorderRadius, Colors, ThemeMode } from '@/constants/theme';
import { PLANS, planSupportsMultiUser } from '@/constants/plans';
import { DEV_PREVIEW_PAYWALL } from '@/constants/featureFlags';

const themeOptions: { mode: ThemeMode; label: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [
  { mode: 'light', label: 'Light', icon: 'sun', color: '#F59E0B' },
  { mode: 'dark', label: 'Dark', icon: 'moon', color: '#6366F1' },
  { mode: 'pink', label: 'Pink', icon: 'heart', color: '#EC4899' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, themeMode, setThemeMode } = useTheme();
  const { user, signOut, deleteAccount, resetToFree, updateUserSettings } = useAuth();
  const navigation = useNavigation<any>();

  const currentPlan = user?.plan || 'free';
  const planInfo = PLANS[currentPlan] || PLANS.free;
  const vehicleLimit = user?.vehicleLimit || planInfo.vehicleLimit;
  const { vehicles, serviceLogs, maintenanceTasks } = useData();
  const { fleet, myFleetRole, isFleetAdmin, createFleet } = useFleet();
  
  const [showFleetNameModal, setShowFleetNameModal] = useState(false);
  const [fleetName, setFleetName] = useState('');
  const [isCreatingFleet, setIsCreatingFleet] = useState(false);
  
  const isFleetPlan = currentPlan === 'fleet_starter' || currentPlan === 'fleet_pro';
  const needsFleetCreation = isFleetPlan && !fleet;

  const handleDismissFleetModal = () => {
    setShowFleetNameModal(false);
    setFleetName('');
  };

  const handleCreateFleet = async () => {
    if (!fleetName.trim()) {
      Alert.alert('Fleet Name Required', 'Please enter a name for your fleet or company.');
      return;
    }
    
    setIsCreatingFleet(true);
    try {
      await createFleet(fleetName.trim());
      handleDismissFleetModal();
      Alert.alert('Fleet Created', 'Your fleet has been created successfully. You can now add vehicles and invite team members.');
    } catch (error) {
      Alert.alert('Error', 'Failed to create fleet. Please try again.');
      handleDismissFleetModal();
    } finally {
      setIsCreatingFleet(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          onPress: signOut,
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This will permanently delete all your data including vehicles, maintenance records, and service logs.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: deleteAccount,
        },
      ]
    );
  };

  const handleResetToFree = () => {
    Alert.alert(
      'Reset to Free Plan',
      'This will reset your account to the Free plan with 1 vehicle limit. This is a dev-only feature.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: resetToFree,
        },
      ]
    );
  };

  const colors = Colors[themeMode];

  const renderSettingItem = (
    icon: keyof typeof Feather.glyphMap,
    title: string,
    subtitle?: string,
    onPress?: () => void,
    destructive?: boolean
  ) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.settingItem,
        { backgroundColor: theme.backgroundDefault, opacity: pressed && onPress ? 0.8 : 1 },
      ]}
    >
      <Feather
        name={icon}
        size={20}
        color={destructive ? colors.danger : theme.primary}
      />
      <View style={styles.settingContent}>
        <ThemedText
          type="body"
          style={{ color: destructive ? colors.danger : theme.text }}
        >
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {onPress ? (
        <Feather name="chevron-right" size={18} color={theme.textSecondary} />
      ) : null}
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.section}>
          <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            PROFILE
          </ThemedText>
          <View style={[styles.profileCard, { backgroundColor: theme.backgroundDefault }]}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <ThemedText type="h2" style={{ color: '#FFFFFF' }}>
                {user?.displayName?.charAt(0).toUpperCase() || 'U'}
              </ThemedText>
            </View>
            <View style={styles.profileInfo}>
              <ThemedText type="h4">{user?.displayName || 'User'}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {user?.email || ''}
              </ThemedText>
            </View>
          </View>
        </View>

        {fleet ? (
          <View style={styles.section}>
            <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              FLEET MEMBERSHIP
            </ThemedText>
            <View style={[styles.fleetCard, { backgroundColor: theme.backgroundDefault }]}>
              <View style={[styles.fleetIcon, { backgroundColor: theme.primary + '20' }]}>
                <Feather name="truck" size={24} color={theme.primary} />
              </View>
              <View style={styles.fleetInfo}>
                <ThemedText type="h4">{fleet.name}</ThemedText>
                <View style={styles.fleetBadgeRow}>
                  <View style={[styles.roleBadge, { backgroundColor: isFleetAdmin ? theme.primary : theme.backgroundSecondary }]}>
                    <ThemedText type="small" style={{ color: isFleetAdmin ? '#FFFFFF' : theme.textSecondary, fontWeight: '600' }}>
                      {isFleetAdmin ? 'Admin' : myFleetRole === 'driver' ? 'Driver' : 'Member'}
                    </ThemedText>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            APPEARANCE
          </ThemedText>
          <View style={[styles.themeContainer, { backgroundColor: theme.backgroundDefault }]}>
            {themeOptions.map((option) => (
              <Pressable
                key={option.mode}
                onPress={() => setThemeMode(option.mode)}
                style={({ pressed }) => [
                  styles.themeOption,
                  {
                    backgroundColor: themeMode === option.mode ? theme.backgroundSecondary : 'transparent',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.themeIconContainer,
                    {
                      backgroundColor: themeMode === option.mode ? option.color : theme.backgroundTertiary,
                    },
                  ]}
                >
                  <Feather
                    name={option.icon}
                    size={20}
                    color={themeMode === option.mode ? '#FFFFFF' : theme.textSecondary}
                  />
                </View>
                <ThemedText
                  type="small"
                  style={{
                    color: themeMode === option.mode ? theme.text : theme.textSecondary,
                    fontWeight: themeMode === option.mode ? '600' : '400',
                  }}
                >
                  {option.label}
                </ThemedText>
                {themeMode === option.mode ? (
                  <Feather name="check" size={16} color={theme.primary} style={styles.checkIcon} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            STATISTICS
          </ThemedText>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
              <Feather name="truck" size={24} color={theme.primary} />
              <ThemedText type="h2">{vehicles.length}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Vehicles
              </ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
              <Feather name="tool" size={24} color={theme.primary} />
              <ThemedText type="h2">{maintenanceTasks.length}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Tasks
              </ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
              <Feather name="file-text" size={24} color={theme.primary} />
              <ThemedText type="h2">{serviceLogs.length}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Logs
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            SUBSCRIPTION
          </ThemedText>
          <View style={styles.settingsList}>
            {renderSettingItem(
              'zap',
              planInfo.name,
              `${vehicles.length} of ${vehicleLimit === Infinity ? 'Unlimited' : vehicleLimit} vehicles used`,
              () => navigation.navigate('Pricing')
            )}
            {needsFleetCreation ? (
              <Pressable
                onPress={() => setShowFleetNameModal(true)}
                style={({ pressed }) => [
                  styles.createFleetButton,
                  { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Feather name="plus-circle" size={20} color="#FFFFFF" />
                <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                  Create Your Fleet
                </ThemedText>
              </Pressable>
            ) : null}
            {planSupportsMultiUser(currentPlan) && fleet ? (
              renderSettingItem(
                'users',
                'Members',
                'Manage shared access',
                () => navigation.navigate('FamilyManagement')
              )
            ) : null}
          </View>
        </View>

        {DEV_PREVIEW_PAYWALL ? (
          <View style={styles.section}>
            <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              DEV TOOLS
            </ThemedText>
            <View style={styles.settingsList}>
              {renderSettingItem(
                'refresh-cw',
                'Reset to Free Plan',
                'Dev only - resets plan to free',
                handleResetToFree
              )}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            NOTIFICATIONS
          </ThemedText>
          <View style={styles.settingsList}>
            <View
              style={[
                styles.settingItem,
                { backgroundColor: theme.backgroundDefault },
              ]}
            >
              <Feather name="bell" size={20} color={theme.primary} />
              <View style={styles.settingContent}>
                <ThemedText type="body">Odometer Reminders</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Remind to update odometer after 14 days
                </ThemedText>
              </View>
              <Switch
                value={!user?.disableOdometerReminders}
                onValueChange={(enabled) => updateUserSettings({ disableOdometerReminders: !enabled })}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            ABOUT
          </ThemedText>
          <View style={styles.settingsList}>
            {renderSettingItem('info', 'Version', '1.0.0')}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            ACCOUNT
          </ThemedText>
          <View style={styles.settingsList}>
            {renderSettingItem('log-out', 'Sign Out', undefined, handleSignOut)}
            {renderSettingItem('trash-2', 'Delete Account', 'Permanently delete all data', handleDeleteAccount, true)}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showFleetNameModal}
        transparent
        animationType="fade"
        onRequestClose={handleDismissFleetModal}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleDismissFleetModal}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText type="h3" style={styles.modalTitle}>
              Name Your Fleet
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: 'center', marginBottom: Spacing.lg }}>
              Enter your company or fleet name
            </ThemedText>
            <TextInput
              style={[styles.fleetNameInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="e.g. ABC Trucking Co."
              placeholderTextColor={theme.textSecondary}
              value={fleetName}
              onChangeText={setFleetName}
              autoFocus
              autoCapitalize="words"
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={handleDismissFleetModal}
              >
                <ThemedText type="body">Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.primary, opacity: isCreatingFleet ? 0.6 : 1 }]}
                onPress={handleCreateFleet}
                disabled={isCreatingFleet}
              >
                <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                  {isCreatingFleet ? 'Creating...' : 'Create Fleet'}
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    fontWeight: '600',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  themeContainer: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
  },
  themeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  settingsList: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  fleetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  fleetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleetInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  fleetBadgeRow: {
    flexDirection: 'row',
  },
  roleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs / 2,
    borderRadius: BorderRadius.xs,
  },
  createFleetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  modalTitle: {
    marginBottom: Spacing.sm,
  },
  fleetNameInput: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
