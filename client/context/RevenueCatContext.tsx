/**
 * RevenueCatContext.tsx - Subscription Management Layer
 * 
 * This context manages subscriptions using RevenueCat for Apple In-App Purchases.
 * It handles initialization, user identification, purchasing, restoring, and syncing
 * entitlements with Firebase user data.
 * 
 * Entitlements:
 * - personal_pro: Personal Pro plan
 * - family: Family plan
 * - fleet_starter: Fleet Starter plan
 * - fleet_pro: Fleet Pro plan
 * - No entitlement: Free plan
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOfferings,
  LOG_LEVEL,
} from 'react-native-purchases';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PlanId, AccountType, User } from '@/types';
import { PLANS } from '@/constants/plans';
import Constants from 'expo-constants';

const REVENUECAT_API_KEY = Constants.expoConfig?.extra?.revenueCatApiKey || process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';

type EntitlementId = 'personal_pro' | 'family' | 'fleet_starter' | 'fleet_pro';

const ENTITLEMENT_TO_PLAN: Record<EntitlementId, PlanId> = {
  personal_pro: 'personal_pro',
  family: 'family',
  fleet_starter: 'fleet_starter',
  fleet_pro: 'fleet_pro',
};

interface RevenueCatContextType {
  isReady: boolean;
  isLoading: boolean;
  offerings: PurchasesOfferings | null;
  customerInfo: CustomerInfo | null;
  currentEntitlement: EntitlementId | null;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  getPackagesForPlan: (planId: PlanId) => PurchasesPackage[];
  syncEntitlements: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

interface RevenueCatProviderProps {
  children: ReactNode;
  user: User | null;
  onPlanUpdate: (planData: {
    plan: PlanId;
    accountType: AccountType;
    vehicleLimit: number;
    userLimit: number;
  }) => Promise<void>;
}

export function RevenueCatProvider({ children, user, onPlanUpdate }: RevenueCatProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [lastIdentifiedUserId, setLastIdentifiedUserId] = useState<string | null>(null);

  const getActiveEntitlement = useCallback((info: CustomerInfo | null): EntitlementId | null => {
    if (!info) return null;
    
    const entitlements = info.entitlements.active;
    const entitlementIds: EntitlementId[] = ['fleet_pro', 'fleet_starter', 'family', 'personal_pro'];
    
    for (const entitlementId of entitlementIds) {
      if (entitlements[entitlementId]?.isActive) {
        return entitlementId;
      }
    }
    
    return null;
  }, []);

  const currentEntitlement = getActiveEntitlement(customerInfo);

  const syncFirebaseWithEntitlement = useCallback(async (
    userId: string,
    entitlement: EntitlementId | null
  ) => {
    const planId: PlanId = entitlement ? ENTITLEMENT_TO_PLAN[entitlement] : 'free';
    const plan = PLANS[planId];
    
    const planData = {
      plan: planId,
      accountType: plan.accountType,
      vehicleLimit: plan.vehicleLimit,
      userLimit: plan.userLimit,
    };

    await setDoc(doc(db, 'users', userId), {
      ...planData,
      updatedAt: Date.now(),
    }, { merge: true });

    await onPlanUpdate(planData);
  }, [onPlanUpdate]);

  useEffect(() => {
    let isMounted = true;

    async function initializeRevenueCat() {
      if (!REVENUECAT_API_KEY) {
        console.log('RevenueCat API key not configured');
        setIsReady(true);
        return;
      }

      if (Platform.OS === 'web') {
        console.log('RevenueCat is not available on web platform');
        setIsReady(true);
        return;
      }

      try {
        Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.INFO : LOG_LEVEL.ERROR);
        
        if (Platform.OS === 'ios') {
          await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
          console.log('RevenueCat configured successfully');
        } else {
          console.log('Only iOS is supported for RevenueCat');
          setIsReady(true);
          return;
        }

        if (isMounted) {
          setIsReady(true);
        }
      } catch (error: any) {
        if (error?.message?.includes('search') || error?.message?.includes('tracking')) {
          console.log('RevenueCat initialized (tracking event skipped in Expo Go)');
          if (isMounted) {
            setIsReady(true);
          }
        } else {
          console.error('Error initializing RevenueCat:', error);
          if (isMounted) {
            setIsReady(true);
          }
        }
      }
    }

    initializeRevenueCat();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function identifyAndFetch() {
      if (!isReady || !REVENUECAT_API_KEY || Platform.OS === 'web') return;
      if (isIdentifying) return;
      if (user && lastIdentifiedUserId === user.id) return;

      if (user) {
        setIsIdentifying(true);
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (!isMounted) return;
          
          const { customerInfo: info } = await Purchases.logIn(user.id);
          
          if (isMounted) {
            setCustomerInfo(info);
            setLastIdentifiedUserId(user.id);
            
            const entitlement = getActiveEntitlement(info);
            const expectedPlan = entitlement ? ENTITLEMENT_TO_PLAN[entitlement] : 'free';
            
            if (user.plan !== expectedPlan) {
              await syncFirebaseWithEntitlement(user.id, entitlement);
            }
          }
        } catch (error: any) {
          if (error?.code === 16 || error?.message?.includes('429')) {
            console.log('RevenueCat rate limited, will retry on next app open');
          } else {
            console.error('Error identifying user in RevenueCat:', error);
          }
        } finally {
          if (isMounted) {
            setIsIdentifying(false);
          }
        }
      } else {
        if (lastIdentifiedUserId) {
          try {
            await Purchases.logOut();
            if (isMounted) {
              setCustomerInfo(null);
              setLastIdentifiedUserId(null);
            }
          } catch (error) {
            console.log('Error logging out from RevenueCat:', error);
          }
        }
      }
    }

    identifyAndFetch();

    return () => {
      isMounted = false;
    };
  }, [isReady, user?.id, getActiveEntitlement, syncFirebaseWithEntitlement, isIdentifying, lastIdentifiedUserId]);

  useEffect(() => {
    async function fetchOfferings() {
      if (!isReady || !REVENUECAT_API_KEY || Platform.OS === 'web') return;

      try {
        const offerings = await Purchases.getOfferings();
        setOfferings(offerings);
      } catch (error) {
        console.error('Error fetching offerings:', error);
      }
    }

    fetchOfferings();
  }, [isReady]);

  useEffect(() => {
    if (!isReady || !REVENUECAT_API_KEY || Platform.OS === 'web') return;

    const listener = (info: CustomerInfo) => {
      setCustomerInfo(info);
      
      if (user) {
        const entitlement = getActiveEntitlement(info);
        syncFirebaseWithEntitlement(user.id, entitlement);
      }
    };

    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [isReady, user?.id, getActiveEntitlement, syncFirebaseWithEntitlement]);

  const purchasePackage = async (pkg: PurchasesPackage): Promise<boolean> => {
    if (!user || Platform.OS === 'web') {
      Alert.alert('Not Available', 'Purchases are only available in the iOS app.');
      return false;
    }

    if (!REVENUECAT_API_KEY) {
      Alert.alert('Configuration Error', 'RevenueCat is not configured.');
      return false;
    }

    setIsLoading(true);

    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);

      const entitlement = getActiveEntitlement(info);
      await syncFirebaseWithEntitlement(user.id, entitlement);

      setIsLoading(false);
      return true;
    } catch (error: any) {
      setIsLoading(false);

      if (error.userCancelled) {
        return false;
      }

      console.error('Purchase error:', error);
      Alert.alert('Purchase Failed', error.message || 'An error occurred during purchase.');
      return false;
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    if (!user || Platform.OS === 'web') {
      Alert.alert('Not Available', 'Restore is only available in the iOS app.');
      return false;
    }

    if (!REVENUECAT_API_KEY) {
      Alert.alert('Configuration Error', 'RevenueCat is not configured.');
      return false;
    }

    setIsLoading(true);

    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);

      const entitlement = getActiveEntitlement(info);
      await syncFirebaseWithEntitlement(user.id, entitlement);

      setIsLoading(false);

      if (entitlement) {
        Alert.alert('Purchases Restored', `Your ${PLANS[ENTITLEMENT_TO_PLAN[entitlement]].name} subscription has been restored.`);
        return true;
      } else {
        Alert.alert('No Purchases Found', 'No active subscriptions were found for your account.');
        return false;
      }
    } catch (error: any) {
      setIsLoading(false);
      console.error('Restore error:', error);
      Alert.alert('Restore Failed', error.message || 'An error occurred while restoring purchases.');
      return false;
    }
  };

  const getPackagesForPlan = (planId: PlanId): PurchasesPackage[] => {
    if (!offerings || planId === 'free') return [];

    const entitlementId = planId as EntitlementId;
    
    const allPackages: PurchasesPackage[] = [];
    
    if (offerings.current?.availablePackages) {
      allPackages.push(...offerings.current.availablePackages);
    }

    Object.values(offerings.all).forEach(offering => {
      if (offering.availablePackages) {
        offering.availablePackages.forEach(pkg => {
          if (!allPackages.find(p => p.identifier === pkg.identifier)) {
            allPackages.push(pkg);
          }
        });
      }
    });

    return allPackages.filter(pkg => {
      const productId = pkg.product.identifier.toLowerCase();
      return productId.includes(entitlementId.replace('_', ''));
    });
  };

  const syncEntitlements = async (): Promise<void> => {
    if (!user || !REVENUECAT_API_KEY || Platform.OS === 'web') return;

    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);

      const entitlement = getActiveEntitlement(info);
      await syncFirebaseWithEntitlement(user.id, entitlement);
    } catch (error) {
      console.error('Error syncing entitlements:', error);
    }
  };

  return (
    <RevenueCatContext.Provider
      value={{
        isReady,
        isLoading,
        offerings,
        customerInfo,
        currentEntitlement,
        purchasePackage,
        restorePurchases,
        getPackagesForPlan,
        syncEntitlements,
      }}
    >
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  const context = useContext(RevenueCatContext);
  if (context === undefined) {
    throw new Error('useRevenueCat must be used within a RevenueCatProvider');
  }
  return context;
}
