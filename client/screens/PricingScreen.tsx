import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Modal, TextInput, Alert, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { useFleet } from '@/context/FleetContext';
import { useRevenueCat } from '@/context/RevenueCatContext';
import { Spacing, BorderRadius } from '@/constants/theme';
import { PLANS, PlanId, Plan, AccountType } from '@/constants/plans';
import { DEV_PREVIEW_PAYWALL, PAYWALLS_ENABLED } from '@/constants/featureFlags';

interface PlanCardProps {
  plan: Plan;
  isCurrentPlan: boolean;
  onSelect: () => void;
}

function PlanCard({ plan, isCurrentPlan, onSelect }: PlanCardProps) {
  const { theme } = useTheme();

  return (
    <Card
      elevation={isCurrentPlan ? 2 : 1}
      style={{
        ...styles.planCard,
        ...(isCurrentPlan ? { borderWidth: 2, borderColor: theme.primary } : {}),
      }}
      onPress={onSelect}
    >
      <View style={styles.planHeader}>
        <View>
          <ThemedText type="h4">{plan.name}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {plan.description}
          </ThemedText>
        </View>
        {isCurrentPlan ? (
          <View style={[styles.badge, { backgroundColor: theme.primary }]}>
            <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '600' }}>
              Current
            </ThemedText>
          </View>
        ) : null}
      </View>

      <ThemedText type="h2" style={styles.price}>
        {plan.priceCopy}
      </ThemedText>

      <View style={styles.features}>
        {plan.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Feather name="check" size={16} color={theme.success} />
            <ThemedText type="small">{feature}</ThemedText>
          </View>
        ))}
      </View>

      {!isCurrentPlan ? (
        <Pressable
          style={[styles.selectButton, { backgroundColor: theme.primary }]}
          onPress={onSelect}
        >
          <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
            {DEV_PREVIEW_PAYWALL ? 'Select Plan (Preview)' : 'Select Plan'}
          </ThemedText>
        </Pressable>
      ) : null}
    </Card>
  );
}

export default function PricingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, updatePlan } = useAuth();
  const { createFleet, fleet } = useFleet();
  const { 
    isLoading: isRevenueCatLoading, 
    offerings, 
    purchasePackage, 
    restorePurchases,
    getPackagesForPlan 
  } = useRevenueCat();
  
  const [showFleetNameModal, setShowFleetNameModal] = useState(false);
  const [fleetName, setFleetName] = useState('');
  const [pendingFleetPlan, setPendingFleetPlan] = useState<PlanId | null>(null);
  const [isCreatingFleet, setIsCreatingFleet] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const currentPlanId = user?.plan || 'free';
  const accountType = user?.accountType || 'personal';

  const personalPlans: PlanId[] = ['free', 'personal_pro', 'family'];
  const fleetPlans: PlanId[] = ['fleet_starter', 'fleet_pro'];

  const isPaywallsActive = PAYWALLS_ENABLED && Platform.OS === 'ios';

  const handleSelectPlan = async (planId: PlanId) => {
    if (planId === currentPlanId) return;
    
    if (isPaywallsActive) {
      const packages = getPackagesForPlan(planId);
      
      if (packages.length === 0) {
        Alert.alert('Not Available', 'This plan is not available for purchase at this time.');
        return;
      }

      if (planId === 'fleet_starter' || planId === 'fleet_pro') {
        if (!fleet) {
          setPendingFleetPlan(planId);
          setShowFleetNameModal(true);
          return;
        }
      }

      setIsPurchasing(true);
      const success = await purchasePackage(packages[0]);
      setIsPurchasing(false);

      if (success) {
        navigation.goBack();
      }
    } else if (DEV_PREVIEW_PAYWALL) {
      if (planId === 'fleet_starter' || planId === 'fleet_pro') {
        if (!fleet) {
          setPendingFleetPlan(planId);
          setShowFleetNameModal(true);
          return;
        }
      }
      await updatePlan(planId);
      navigation.goBack();
    }
  };

  const handleRestorePurchases = async () => {
    setIsPurchasing(true);
    await restorePurchases();
    setIsPurchasing(false);
  };

  const handleCreateFleet = async () => {
    if (!fleetName.trim()) {
      Alert.alert('Fleet Name Required', 'Please enter a name for your fleet or company.');
      return;
    }
    
    if (!pendingFleetPlan) return;
    
    setIsCreatingFleet(true);
    try {
      await createFleet(fleetName.trim());
      
      if (isPaywallsActive) {
        const packages = getPackagesForPlan(pendingFleetPlan);
        if (packages.length > 0) {
          const success = await purchasePackage(packages[0]);
          if (!success) {
            setShowFleetNameModal(false);
            setFleetName('');
            setPendingFleetPlan(null);
            setIsCreatingFleet(false);
            return;
          }
        }
      } else {
        await updatePlan(pendingFleetPlan);
      }
      
      setShowFleetNameModal(false);
      setFleetName('');
      setPendingFleetPlan(null);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to create fleet. Please try again.');
      setShowFleetNameModal(false);
      setFleetName('');
      setPendingFleetPlan(null);
    } finally {
      setIsCreatingFleet(false);
    }
  };

  const handleDismissFleetModal = () => {
    setShowFleetNameModal(false);
    setFleetName('');
    setPendingFleetPlan(null);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText type="h2">Choose Your Plan</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: 'center' }}>
            Upgrade to manage more vehicles and unlock premium features
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Personal Plans</ThemedText>
          {personalPlans.map((planId) => (
            <PlanCard
              key={planId}
              plan={PLANS[planId]}
              isCurrentPlan={currentPlanId === planId}
              onSelect={() => handleSelectPlan(planId)}
            />
          ))}
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Fleet Plans</ThemedText>
          {fleetPlans.map((planId) => (
            <PlanCard
              key={planId}
              plan={PLANS[planId]}
              isCurrentPlan={currentPlanId === planId}
              onSelect={() => handleSelectPlan(planId)}
            />
          ))}
        </View>

        {Platform.OS === 'ios' && PAYWALLS_ENABLED ? (
          <Pressable
            style={styles.restoreButton}
            onPress={handleRestorePurchases}
            disabled={isPurchasing || isRevenueCatLoading}
          >
            <ThemedText type="body" style={{ color: theme.primary }}>
              Restore Purchases
            </ThemedText>
          </Pressable>
        ) : null}

        {DEV_PREVIEW_PAYWALL && !PAYWALLS_ENABLED ? (
          <View style={[styles.devNote, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="info" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
              Payment preview mode: Plans can be selected without real payment. This is for testing only.
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>

      {(isPurchasing || isRevenueCatLoading) ? (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText type="body" style={{ marginTop: Spacing.md }}>
              Processing...
            </ThemedText>
          </View>
        </View>
      ) : null}

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
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  planCard: {
    gap: Spacing.md,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  price: {
    marginVertical: Spacing.xs,
  },
  features: {
    gap: Spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  selectButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  devNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
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
  restoreButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
});
