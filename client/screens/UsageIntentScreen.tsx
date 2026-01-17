import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { Spacing, BorderRadius } from '@/constants/theme';
import { AccountType } from '@/constants/plans';

interface IntentOption {
  type: AccountType;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
}

const options: IntentOption[] = [
  {
    type: 'personal',
    title: 'Personal Use',
    description: 'For myself or my family vehicles',
    icon: 'user',
  },
  {
    type: 'fleet',
    title: 'Fleet / Business',
    description: 'For managing multiple drivers or business vehicles',
    icon: 'truck',
  },
];

export default function UsageIntentScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { setAccountType } = useAuth();
  const [selected, setSelected] = React.useState<AccountType | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSelect = (type: AccountType) => {
    setSelected(type);
  };

  const handleContinue = async () => {
    if (!selected) return;
    
    setIsLoading(true);
    try {
      await setAccountType(selected);
    } catch (error) {
      console.error('Error setting account type:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + Spacing['3xl'], paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
            <Feather name="help-circle" size={32} color={theme.primary} />
          </View>
          <ThemedText type="h2" style={styles.title}>How will you use DriveIQ?</ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            This helps us personalize your experience
          </ThemedText>
        </View>

        <View style={styles.options}>
          {options.map((option) => (
            <Card
              key={option.type}
              onPress={() => handleSelect(option.type)}
              elevation={selected === option.type ? 2 : 1}
              style={{
                ...styles.optionCard,
                ...(selected === option.type ? { borderWidth: 2, borderColor: theme.primary } : {}),
              }}
            >
              <View style={styles.optionContent}>
                <View style={[styles.optionIcon, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name={option.icon} size={24} color={theme.primary} />
                </View>
                <View style={styles.optionText}>
                  <ThemedText type="h4">{option.title}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {option.description}
                  </ThemedText>
                </View>
                {selected === option.type ? (
                  <View style={[styles.checkmark, { backgroundColor: theme.primary }]}>
                    <Feather name="check" size={16} color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={[styles.radioOuter, { borderColor: theme.border }]} />
                )}
              </View>
            </Card>
          ))}
        </View>

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.continueButton,
              { backgroundColor: selected ? theme.primary : theme.backgroundTertiary },
            ]}
            onPress={handleContinue}
            disabled={!selected || isLoading}
          >
            <ThemedText
              type="body"
              style={{
                color: selected ? '#FFFFFF' : theme.textSecondary,
                fontWeight: '600',
              }}
            >
              {isLoading ? 'Setting up...' : 'Continue'}
            </ThemedText>
          </Pressable>
        </View>
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
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing['3xl'],
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  options: {
    gap: Spacing.md,
    flex: 1,
  },
  optionCard: {
    padding: Spacing.lg,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    gap: Spacing.xs,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: Spacing.xl,
  },
  continueButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
