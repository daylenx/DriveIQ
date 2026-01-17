/**
 * RevenueCatWrapper.tsx - Integration wrapper for RevenueCat with Auth
 * 
 * This component wraps children with RevenueCatProvider and provides
 * the necessary callbacks for plan updates.
 */

import React, { ReactNode, useCallback } from 'react';
import { RevenueCatProvider } from '@/context/RevenueCatContext';
import { useAuth } from '@/context/AuthContext';
import { PlanId, AccountType } from '@/types';

interface RevenueCatWrapperProps {
  children: ReactNode;
}

export function RevenueCatWrapper({ children }: RevenueCatWrapperProps) {
  const { user, refreshUserProfile } = useAuth();

  const handlePlanUpdate = useCallback(async (planData: {
    plan: PlanId;
    accountType: AccountType;
    vehicleLimit: number;
    userLimit: number;
  }) => {
    await refreshUserProfile();
  }, [refreshUserProfile]);

  return (
    <RevenueCatProvider user={user} onPlanUpdate={handlePlanUpdate}>
      {children}
    </RevenueCatProvider>
  );
}
