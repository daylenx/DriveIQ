import React from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { Spacing, BorderRadius } from '@/constants/theme';
import { PLANS, PlanId, getSuggestedUpgrade } from '@/constants/plans';
import { DEV_PREVIEW_PAYWALL, PAYWALLS_ENABLED } from '@/constants/featureFlags';

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  reason?: string;
  suggestedPlanId?: PlanId;
  onContinueAnyway?: () => void;
}

export function UpgradeModal({
  visible,
  onClose,
  reason = 'You have reached your vehicle limit',
  suggestedPlanId,
  onContinueAnyway,
}: UpgradeModalProps) {
  const { theme } = useTheme();
  const { user, updatePlan } = useAuth();
  const navigation = useNavigation<any>();

  const currentPlanId = user?.plan || 'free';
  const accountType = user?.accountType || 'personal';
  const targetPlanId = suggestedPlanId || getSuggestedUpgrade(currentPlanId, accountType) || 'personal_pro';
  const targetPlan = PLANS[targetPlanId] || PLANS.personal_pro;

  const handleUpgrade = async () => {
    if (DEV_PREVIEW_PAYWALL) {
      await updatePlan(targetPlanId);
      onClose();
    } else {
      onClose();
      navigation.navigate('Pricing');
    }
  };

  const handleViewPlans = () => {
    onClose();
    navigation.navigate('Pricing');
  };

  const handleContinueAnyway = () => {
    if (onContinueAnyway) {
      onContinueAnyway();
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
              <Feather name="zap" size={28} color={theme.primary} />
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ThemedText type="h3" style={styles.title}>Upgrade Required</ThemedText>
          <ThemedText type="body" style={[styles.reason, { color: theme.textSecondary }]}>
            {reason}
          </ThemedText>

          <View style={[styles.planPreview, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.planInfo}>
              <ThemedText type="h4">{targetPlan.name}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {targetPlan.description}
              </ThemedText>
            </View>
            <ThemedText type="h4" style={{ color: theme.primary }}>
              {targetPlan.priceCopy}
            </ThemedText>
          </View>

          <View style={styles.features}>
            {targetPlan.features.slice(0, 4).map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Feather name="check-circle" size={16} color={theme.success} />
                <ThemedText type="small">{feature}</ThemedText>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            {DEV_PREVIEW_PAYWALL ? (
              <Pressable
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={handleUpgrade}
              >
                <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                  Simulate Upgrade (Dev)
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={handleViewPlans}
              >
                <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                  View Plans
                </ThemedText>
              </Pressable>
            )}

            <Pressable
              style={[styles.secondaryButton, { borderColor: theme.border }]}
              onPress={handleViewPlans}
            >
              <ThemedText type="body" style={{ color: theme.primary }}>
                Compare All Plans
              </ThemedText>
            </Pressable>

            {DEV_PREVIEW_PAYWALL && !PAYWALLS_ENABLED && onContinueAnyway ? (
              <Pressable
                style={styles.textButton}
                onPress={handleContinueAnyway}
              >
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Continue anyway (Dev mode)
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    padding: Spacing.xs,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  reason: {
    marginBottom: Spacing.lg,
  },
  planPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  planInfo: {
    gap: Spacing.xs,
  },
  features: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actions: {
    gap: Spacing.md,
  },
  primaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: {
    alignItems: 'center',
    padding: Spacing.sm,
  },
});
