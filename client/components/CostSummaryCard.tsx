import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { ServiceLog } from '@/types';
import { Spacing, BorderRadius } from '@/constants/theme';

interface CostSummaryCardProps {
  serviceLogs: ServiceLog[];
  onUpgrade?: () => void;
}

interface CategoryBreakdown {
  category: string;
  total: number;
}

export function CostSummaryCard({ serviceLogs, onUpgrade }: CostSummaryCardProps) {
  const { theme } = useTheme();
  const { user } = useAuth();

  const proPlans = ['personal_pro', 'fleet_starter', 'fleet_pro'];
  const isPro = user?.plan && proPlans.includes(user.plan);

  const logsWithCost = serviceLogs.filter((log) => log.cost !== undefined && log.cost > 0);
  const totalCost = logsWithCost.reduce((sum, log) => sum + (log.cost || 0), 0);

  const categoryBreakdown: CategoryBreakdown[] = [];
  const categoryMap: Record<string, number> = {};

  logsWithCost.forEach((log) => {
    const category = log.category || 'Other';
    categoryMap[category] = (categoryMap[category] || 0) + (log.cost || 0);
  });

  Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([category, total]) => {
      categoryBreakdown.push({ category, total });
    });

  const recentCosts = [...logsWithCost]
    .sort((a, b) => b.date - a.date)
    .slice(0, 3);

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (!isPro) {
    return (
      <Card style={styles.card}>
        <View style={styles.lockedHeader}>
          <View style={[styles.lockIcon, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="lock" size={20} color={theme.textSecondary} />
          </View>
          <ThemedText type="h4">Cost Summary</ThemedText>
        </View>
        <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
          See how much you've spent on maintenance with DriveIQ Pro.
        </ThemedText>
        <View style={[styles.previewBlur, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.previewRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Total Spent</ThemedText>
            <View style={[styles.blurredText, { backgroundColor: theme.border }]} />
          </View>
          <View style={styles.previewRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Top Category</ThemedText>
            <View style={[styles.blurredText, { backgroundColor: theme.border, width: 60 }]} />
          </View>
        </View>
        {onUpgrade ? (
          <Pressable
            style={[styles.upgradeButton, { backgroundColor: theme.primary }]}
            onPress={onUpgrade}
          >
            <ThemedText type="body" style={{ color: '#FFFFFF' }}>Upgrade to Pro</ThemedText>
          </Pressable>
        ) : null}
      </Card>
    );
  }

  if (logsWithCost.length === 0) {
    return (
      <Card style={styles.card}>
        <View style={styles.header}>
          <Feather name="dollar-sign" size={20} color={theme.primary} />
          <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Cost Summary</ThemedText>
        </View>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          No maintenance costs recorded yet. Add costs when logging services to track your spending.
        </ThemedText>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Feather name="dollar-sign" size={20} color={theme.primary} />
        <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Cost Summary</ThemedText>
      </View>

      <View style={styles.totalSection}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>Total Spent</ThemedText>
        <ThemedText type="h2" style={{ color: theme.primary }}>{formatCurrency(totalCost)}</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          from {logsWithCost.length} service{logsWithCost.length !== 1 ? 's' : ''}
        </ThemedText>
      </View>

      {categoryBreakdown.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>By Category</ThemedText>
          {categoryBreakdown.map((item) => (
            <View key={item.category} style={styles.categoryRow}>
              <ThemedText type="body">{item.category}</ThemedText>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                {formatCurrency(item.total)}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {recentCosts.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Recent Costs</ThemedText>
          {recentCosts.map((log) => (
            <View key={log.id} style={styles.recentRow}>
              <View style={styles.recentInfo}>
                <ThemedText type="body" numberOfLines={1}>{log.taskName}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {formatDate(log.date)}
                </ThemedText>
              </View>
              <ThemedText type="body">{formatCurrency(log.cost || 0)}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  lockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  lockIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalSection: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  section: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  recentInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  previewBlur: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  blurredText: {
    height: 16,
    width: 80,
    borderRadius: 4,
  },
  upgradeButton: {
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
});
