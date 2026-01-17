import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { Vehicle } from '@/types';
import { Spacing, BorderRadius } from '@/constants/theme';

interface OdometerReminderBannerProps {
  vehicle: Vehicle;
  onUpdate: () => void;
}

const REMINDER_DAYS_THRESHOLD = 14;
const MIN_DAYS_BETWEEN_REMINDERS = 7;
const SNOOZE_KEY_PREFIX = 'odometer_snooze_';

function getStorageKey(userId: string, vehicleId: string, suffix: string): string {
  return `${SNOOZE_KEY_PREFIX}${userId}_${vehicleId}${suffix}`;
}

export function OdometerReminderBanner({ vehicle, onUpdate }: OdometerReminderBannerProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const hasMarkedShown = useRef(false);

  useEffect(() => {
    hasMarkedShown.current = false;
    checkShouldShowReminder();
  }, [vehicle.id, vehicle.lastOdometerUpdate, user?.disableOdometerReminders, user?.id]);

  useEffect(() => {
    if (showBanner && !hasMarkedShown.current && user?.id) {
      hasMarkedShown.current = true;
      const lastShownKey = getStorageKey(user.id, vehicle.id, '_last_shown');
      AsyncStorage.setItem(lastShownKey, Date.now().toString());
    }
  }, [showBanner, user?.id, vehicle.id]);

  const checkShouldShowReminder = async () => {
    if (!user?.id || user?.disableOdometerReminders) {
      setShowBanner(false);
      return;
    }

    const lastUpdate = vehicle.lastOdometerUpdate || vehicle.createdAt;
    const daysSinceUpdate = Math.floor((Date.now() - lastUpdate) / (1000 * 60 * 60 * 24));

    if (daysSinceUpdate < REMINDER_DAYS_THRESHOLD) {
      setShowBanner(false);
      return;
    }

    const snoozeKey = getStorageKey(user.id, vehicle.id, '');
    const snoozeUntil = await AsyncStorage.getItem(snoozeKey);

    if (snoozeUntil && Date.now() < parseInt(snoozeUntil, 10)) {
      setShowBanner(false);
      return;
    }

    const lastShownKey = getStorageKey(user.id, vehicle.id, '_last_shown');
    const lastShown = await AsyncStorage.getItem(lastShownKey);
    if (lastShown) {
      const daysSinceShown = Math.floor((Date.now() - parseInt(lastShown, 10)) / (1000 * 60 * 60 * 24));
      if (daysSinceShown < MIN_DAYS_BETWEEN_REMINDERS) {
        setShowBanner(false);
        return;
      }
    }

    setShowBanner(true);
  };

  const handleSnooze = async (days: number) => {
    if (!user?.id) return;
    const snoozeKey = getStorageKey(user.id, vehicle.id, '');
    const snoozeUntil = Date.now() + days * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(snoozeKey, snoozeUntil.toString());
    setShowBanner(false);
    setShowSnoozeOptions(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={styles.content}>
        <Feather name="info" size={18} color={theme.primary} style={styles.icon} />
        <View style={styles.textContainer}>
          <ThemedText type="body">
            Quick check-in: update your odometer to keep reminders accurate.
          </ThemedText>
        </View>
      </View>

      {showSnoozeOptions ? (
        <View style={styles.snoozeOptions}>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            Remind me later:
          </ThemedText>
          <View style={styles.snoozeButtons}>
            <Pressable
              style={[styles.snoozeButton, { backgroundColor: theme.backgroundDefault }]}
              onPress={() => handleSnooze(7)}
            >
              <ThemedText type="small">7 days</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.snoozeButton, { backgroundColor: theme.backgroundDefault }]}
              onPress={() => handleSnooze(14)}
            >
              <ThemedText type="small">14 days</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.snoozeButton, { backgroundColor: theme.backgroundDefault }]}
              onPress={() => handleSnooze(30)}
            >
              <ThemedText type="small">30 days</ThemedText>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            style={[styles.updateButton, { backgroundColor: theme.primary }]}
            onPress={onUpdate}
          >
            <ThemedText type="small" style={{ color: '#FFFFFF' }}>Update now</ThemedText>
          </Pressable>
          <Pressable
            style={styles.snoozeLink}
            onPress={() => setShowSnoozeOptions(true)}
          >
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Later</ThemedText>
          </Pressable>
          <Pressable style={styles.dismissButton} onPress={handleDismiss}>
            <Feather name="x" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingLeft: 26,
    gap: Spacing.md,
  },
  updateButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  snoozeLink: {
    paddingVertical: Spacing.xs,
  },
  dismissButton: {
    marginLeft: 'auto',
    padding: Spacing.xs,
  },
  snoozeOptions: {
    marginTop: Spacing.sm,
    paddingLeft: 26,
  },
  snoozeButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  snoozeButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
});
