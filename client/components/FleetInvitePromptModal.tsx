import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useFleet } from '@/context/FleetContext';
import { Spacing, BorderRadius } from '@/constants/theme';

export function FleetInvitePromptModal() {
  const { theme } = useTheme();
  const { myPendingInvite, acceptInvite, declineInvite } = useFleet();
  const [isLoading, setIsLoading] = useState(false);

  if (!myPendingInvite) return null;

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await acceptInvite();
    } catch (error: any) {
      console.error('Error accepting fleet invite:', error);
      Alert.alert(
        'Could Not Join Fleet',
        error?.message || 'There was a problem joining the fleet. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    setIsLoading(true);
    try {
      await declineInvite();
    } catch (error: any) {
      console.error('Error declining fleet invite:', error);
      Alert.alert(
        'Error',
        error?.message || 'There was a problem declining the invitation.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const roleLabel = myPendingInvite.role === 'admin' ? 'Admin' : 'Driver';

  return (
    <Modal
      visible={!!myPendingInvite}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modal, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
            <Feather name="truck" size={32} color={theme.primary} />
          </View>
          
          <ThemedText type="h3" style={styles.title}>
            Fleet Invitation
          </ThemedText>
          
          <ThemedText type="body" style={[styles.message, { color: theme.textSecondary }]}>
            You have been invited to join{' '}
            <ThemedText type="body" style={{ fontWeight: '600', color: theme.text }}>
              {myPendingInvite.fleetName}
            </ThemedText>
            . Joining will give you access to fleet vehicles and maintenance tracking.
          </ThemedText>

          <ThemedText type="small" style={[styles.permission, { color: theme.text }]}>
            Your role: {roleLabel}
          </ThemedText>

          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.declineButton, { borderColor: theme.border }]}
              onPress={handleDecline}
              disabled={isLoading}
            >
              <ThemedText type="body">Decline</ThemedText>
            </Pressable>
            
            <Pressable
              style={[styles.button, styles.acceptButton, { backgroundColor: theme.primary }]}
              onPress={handleAccept}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                  Join Fleet
                </ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  permission: {
    marginBottom: Spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    borderWidth: 1,
  },
  acceptButton: {},
});
