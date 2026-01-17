import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useFamily } from '@/context/FamilyContext';
import { useFleet } from '@/context/FleetContext';
import { Spacing, BorderRadius } from '@/constants/theme';

export function InvitePromptModal() {
  const { theme } = useTheme();
  const { myPendingInvite, acceptInvite, declineInvite } = useFamily();
  const { myPendingInvite: fleetPendingInvite } = useFleet();
  const [isLoading, setIsLoading] = useState(false);

  if (!myPendingInvite) return null;
  
  if (fleetPendingInvite) return null;

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await acceptInvite();
    } catch (error) {
      console.error('Error accepting invite:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    setIsLoading(true);
    try {
      await declineInvite();
    } catch (error) {
      console.error('Error declining invite:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
            <Feather name="users" size={32} color={theme.primary} />
          </View>
          
          <ThemedText type="h3" style={styles.title}>
            Family Invitation
          </ThemedText>
          
          <ThemedText type="body" style={[styles.message, { color: theme.textSecondary }]}>
            You have been invited to join a family plan. Joining will give you access to shared vehicles and maintenance tracking.
          </ThemedText>

          <ThemedText type="small" style={[styles.permission, { color: theme.text }]}>
            Permission: {myPendingInvite.permission === 'full_access' ? 'Full Access' : 'View Only'}
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
                  Join Family
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
