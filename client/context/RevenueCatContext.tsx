/**
 * RevenueCatContext.tsx - Subscription Management Layer
 * 
 * PURPOSE:
 * Manages subscriptions using RevenueCat for Apple In-App Purchases.
 * Handles initialization, user identification, purchasing, restoring, and syncing
 * entitlements with Firebase user data.
 * 
 * ENTITLEMENTS (RevenueCat terminology for subscription tiers):
 * - personal_pro: Personal Pro plan ($X/month)
 * - family: Family plan for households ($X/month)
 * - fleet_starter: Fleet Starter for small businesses ($X/month)
 * - fleet_pro: Fleet Pro for larger fleets ($X/month)
 * - No entitlement: Free plan (default)
 * 
 * ASSUMPTIONS:
 * - RevenueCat is only available on iOS (Android support not implemented)
 * - Web platform will always show free tier (no in-app purchases on web)
 * - Firebase is the source of truth for app data; RevenueCat is source of truth for subscriptions
 * - API key is stored in environment variable or expo config
 * 
 * GUARDRAILS:
 * - Gracefully handles missing API key (shows free tier)
 * - Handles RevenueCat rate limiting (error code 16, HTTP 429)
 * - Prevents duplicate identification calls with lastIdentifiedUserId tracking
 * - Syncs Firebase with RevenueCat on any subscription change
 * - Falls back gracefully in Expo Go (tracking events may fail)
 * 
 * EXTERNAL INTEGRATIONS:
 * - RevenueCat SDK: Handles App Store purchases and subscription management
 * - Firebase Firestore: Stores user plan data for app features
 * - Apple App Store: Backend purchase processing (handled by RevenueCat)
 * 
 * NON-OBVIOUS RULES:
 * - RevenueCat initialization must happen before user identification
 * - Customer info listeners fire automatically when subscriptions change
 * - Entitlement priority: fleet_pro > fleet_starter > family > personal_pro
 * - Web platform shows RevenueCat console logs but works fine in free mode
 * - Expo Go has limited RevenueCat functionality (cannot make real purchases)
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

// API key can come from expo config (preferred) or environment variable
const REVENUECAT_API_KEY = Constants.expoConfig?.extra?.revenueCatApiKey || process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';

type EntitlementId = 'personal_pro' | 'family' | 'fleet_starter' | 'fleet_pro';

// Maps RevenueCat entitlements to app plan IDs
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
  
  // Prevents duplicate identification calls during React re-renders
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [lastIdentifiedUserId, setLastIdentifiedUserId] = useState<string | null>(null);

  /**
   * Determines the highest-priority active entitlement from customer info.
   * 
   * WHY: Users might have multiple entitlements (edge case), so we prioritize
   * by plan tier. Fleet Pro > Fleet Starter > Family > Personal Pro.
   */
  const getActiveEntitlement = useCallback((info: CustomerInfo | null): EntitlementId | null => {
    if (!info) return null;
    
    const entitlements = info.entitlements.active;
    // Priority order: highest tier first
    const entitlementIds: EntitlementId[] = ['fleet_pro', 'fleet_starter', 'family', 'personal_pro'];
    
    for (const entitlementId of entitlementIds) {
      if (entitlements[entitlementId]?.isActive) {
        return entitlementId;
      }
    }
    
    return null;
  }, []);

  const currentEntitlement = getActiveEntitlement(customerInfo);

  /**
   * Syncs RevenueCat entitlement state to Firebase user document.
   * 
   * WHY: App features check Firebase for plan data, not RevenueCat directly.
   * This allows offline access to plan features and faster feature checks.
   * RevenueCat is the source of truth; Firebase is the cache.
   */
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

    // Update Firestore with current plan data
    await setDoc(doc(db, 'users', userId), {
      ...planData,
      updatedAt: Date.now(),
    }, { merge: true });

    // Notify parent component of plan change
    await onPlanUpdate(planData);
  }, [onPlanUpdate]);

  /**
   * INITIALIZATION EFFECT
   * 
   * Configures RevenueCat SDK on app startup.
   * Only runs once; subsequent effects handle user identification.
   */
  useEffect(() => {
    let isMounted = true;

    async function initializeRevenueCat() {
      // Skip if no API key configured
      if (!REVENUECAT_API_KEY) {
        console.log('RevenueCat API key not configured');
        setIsReady(true);
        return;
      }

      // Web platform: RevenueCat doesn't work, but we still show the app
      if (Platform.OS === 'web') {
        console.log('Web platform detected. Using RevenueCat in Browser Mode.');
        console.log('RevenueCat is not available on web platform');
        setIsReady(true);
        return;
      }

      try {
        // Debug logging in development, errors only in production
        Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.INFO : LOG_LEVEL.ERROR);
        
        // iOS only for now - Android would use a different API key
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
        // Expo Go has limited RevenueCat support - tracking events may fail
        // This is expected and safe to ignore
        if (error?.message?.includes('search') || error?.message?.includes('tracking')) {
          console.log('RevenueCat initialized (tracking event skipped in Expo Go)');
          if (isMounted) {
            setIsReady(true);
          }
        } else {
          console.error('Error initializing RevenueCat:', error);
          if (isMounted) {
            setIsReady(true); // Still mark as ready so app works in free mode
          }
        }
      }
    }

    initializeRevenueCat();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * USER IDENTIFICATION EFFECT
   * 
   * Links the Firebase user to RevenueCat for subscription management.
   * Runs when user logs in/out or when RevenueCat becomes ready.
   * 
   * FLOW:
   * 1. Wait for RevenueCat to be ready
   * 2. Log in user to RevenueCat using their Firebase UID
   * 3. Fetch customer info with entitlements
   * 4. Sync entitlements to Firebase if they differ
   * 5. Log out on user sign-out
   */
  useEffect(() => {
    let isMounted = true;

    async function identifyAndFetch() {
      // Skip if not ready or not on iOS
      if (!isReady || !REVENUECAT_API_KEY || Platform.OS === 'web') return;
      
      // Prevent concurrent identification calls
      if (isIdentifying) return;
      
      // Skip if already identified this user
      if (user && lastIdentifiedUserId === user.id) return;

      if (user) {
        setIsIdentifying(true);
        try {
          // Brief delay to avoid rate limiting during rapid auth state changes
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (!isMounted) return;
          
          // Log in to RevenueCat with Firebase UID
          const { customerInfo: info } = await Purchases.logIn(user.id);
          
          if (isMounted) {
            setCustomerInfo(info);
            setLastIdentifiedUserId(user.id);
            
            // Check if Firebase needs updating
            const entitlement = getActiveEntitlement(info);
            const expectedPlan = entitlement ? ENTITLEMENT_TO_PLAN[entitlement] : 'free';
            
            // Sync if plans don't match (subscription changed externally)
            if (user.plan !== expectedPlan) {
              await syncFirebaseWithEntitlement(user.id, entitlement);
            }
          }
        } catch (error: any) {
          // Handle rate limiting gracefully
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
        // User logged out - log out of RevenueCat too
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

  /**
   * OFFERINGS EFFECT
   * 
   * Fetches available purchase packages from RevenueCat.
   * Offerings are configured in the RevenueCat dashboard.
   */
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

  /**
   * CUSTOMER INFO LISTENER EFFECT
   * 
   * Listens for subscription changes (renewal, cancellation, upgrade).
   * RevenueCat fires this automatically when subscription state changes.
   */
  useEffect(() => {
    if (!isReady || !REVENUECAT_API_KEY || Platform.OS === 'web') return;

    const listener = (info: CustomerInfo) => {
      setCustomerInfo(info);
      
      // Sync Firebase whenever subscription changes
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

  /**
   * MAJOR FUNCTION: purchasePackage
   * 
   * Initiates an in-app purchase for the given package.
   * Handles success, cancellation, and error cases.
   * 
   * @returns true if purchase succeeded, false otherwise
   */
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

      // Immediately sync new entitlement to Firebase
      const entitlement = getActiveEntitlement(info);
      await syncFirebaseWithEntitlement(user.id, entitlement);

      setIsLoading(false);
      return true;
    } catch (error: any) {
      setIsLoading(false);

      // User cancelled - not an error
      if (error.userCancelled) {
        return false;
      }

      console.error('Purchase error:', error);
      Alert.alert('Purchase Failed', error.message || 'An error occurred during purchase.');
      return false;
    }
  };

  /**
   * MAJOR FUNCTION: restorePurchases
   * 
   * Restores previous purchases (required by App Store guidelines).
   * Useful when user reinstalls app or switches devices.
   */
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

  /**
   * Returns available purchase packages for a specific plan.
   * Used to display pricing options in the upgrade screen.
   */
  const getPackagesForPlan = (planId: PlanId): PurchasesPackage[] => {
    if (!offerings || planId === 'free') return [];

    const entitlementId = planId as EntitlementId;
    
    const allPackages: PurchasesPackage[] = [];
    
    // Check current offering first
    if (offerings.current?.availablePackages) {
      allPackages.push(...offerings.current.availablePackages);
    }

    // Also check all named offerings
    Object.values(offerings.all).forEach(offering => {
      if (offering.availablePackages) {
        offering.availablePackages.forEach(pkg => {
          // Avoid duplicates
          if (!allPackages.find(p => p.identifier === pkg.identifier)) {
            allPackages.push(pkg);
          }
        });
      }
    });

    // Filter packages by entitlement ID in product identifier
    return allPackages.filter(pkg => {
      const productId = pkg.product.identifier.toLowerCase();
      return productId.includes(entitlementId.replace('_', ''));
    });
  };

  /**
   * Manually syncs entitlements from RevenueCat to Firebase.
   * Useful for ensuring data consistency after background updates.
   */
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
