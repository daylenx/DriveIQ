/**
 * Plan Definitions for DriveIQ
 * 
 * All available subscription plans with their limits and pricing.
 * Pricing is display-only until real payment integration.
 */

import { VehicleType, PlanId, AccountType } from '@/types';

export type { PlanId, AccountType };

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  priceCopy: string;
  priceValue: number;
  isMonthly: boolean;
  isLifetime: boolean;
  vehicleLimit: number;
  userLimit: number;
  allowedVehicleTypes: VehicleType[];
  accountType: AccountType;
  features: string[];
  supportsMultiUser: boolean;
}

export const VEHICLE_TYPE_LABELS: Record<VehicleType, { label: string; icon: string }> = {
  car: { label: 'Passenger Car', icon: 'car' },
  pickup: { label: 'Pickup Truck', icon: 'truck' },
  semi: { label: 'Semi-Truck / Commercial', icon: 'truck' },
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    priceCopy: 'Free',
    priceValue: 0,
    isMonthly: false,
    isLifetime: false,
    vehicleLimit: 1,
    userLimit: 1,
    allowedVehicleTypes: ['car', 'pickup'],
    accountType: 'personal',
    supportsMultiUser: false,
    features: [
      '1 vehicle',
      'Cars and pickups only',
      'Maintenance tracking',
      'Service logging',
      'Odometer updates',
    ],
  },
  personal_pro: {
    id: 'personal_pro',
    name: 'Personal Pro',
    description: 'Great for solo power users',
    priceCopy: '$4.99/month',
    priceValue: 4.99,
    isMonthly: true,
    isLifetime: false,
    vehicleLimit: 5,
    userLimit: 1,
    allowedVehicleTypes: ['car', 'pickup', 'semi'],
    accountType: 'personal',
    supportsMultiUser: false,
    features: [
      'Up to 5 vehicles',
      'All vehicle types including semi-trucks',
      'Maintenance tracking',
      'Service logging',
      'Odometer updates',
    ],
  },
  family: {
    id: 'family',
    name: 'Family Plan',
    description: 'Perfect for households',
    priceCopy: '$7.99/month',
    priceValue: 7.99,
    isMonthly: true,
    isLifetime: false,
    vehicleLimit: 5,
    userLimit: 5,
    allowedVehicleTypes: ['car', 'pickup'],
    accountType: 'personal',
    supportsMultiUser: true,
    features: [
      'Up to 5 vehicles',
      'Up to 5 members',
      'Cars and pickups only',
      'Assign vehicles to members',
      'Shared maintenance logs',
      'Individual reminders per user',
    ],
  },
  fleet_starter: {
    id: 'fleet_starter',
    name: 'Fleet Starter',
    description: 'Designed for small businesses',
    priceCopy: '$14.99/month',
    priceValue: 14.99,
    isMonthly: true,
    isLifetime: false,
    vehicleLimit: 20,
    userLimit: Infinity,
    allowedVehicleTypes: ['car', 'pickup', 'semi'],
    accountType: 'fleet',
    supportsMultiUser: true,
    features: [
      'Up to 20 vehicles',
      'Unlimited team members',
      'All vehicle types',
      'Assign drivers to vehicles',
      'Shared maintenance logs',
      'Team management',
    ],
  },
  fleet_pro: {
    id: 'fleet_pro',
    name: 'Fleet Pro',
    description: 'For large-scale fleet operations',
    priceCopy: '$29.99+/month',
    priceValue: 29.99,
    isMonthly: true,
    isLifetime: false,
    vehicleLimit: Infinity,
    userLimit: Infinity,
    allowedVehicleTypes: ['car', 'pickup', 'semi'],
    accountType: 'fleet',
    supportsMultiUser: true,
    features: [
      'Unlimited vehicles',
      'Unlimited team members',
      'All vehicle types',
      'Assign drivers to vehicles',
      'Reporting & team management',
      'Priority support',
    ],
  },
};

export function getPlan(planId: PlanId): Plan {
  return PLANS[planId] || PLANS.free;
}

export function getSuggestedUpgrade(currentPlan: PlanId, accountType: AccountType): PlanId | null {
  if (accountType === 'personal') {
    if (currentPlan === 'free') return 'personal_pro';
    if (currentPlan === 'personal_pro') return 'family';
    if (currentPlan === 'family') return 'fleet_starter';
    return null;
  }
  
  if (currentPlan === 'fleet_starter') return 'fleet_pro';
  if (currentPlan === 'personal_pro') return 'fleet_starter';
  return 'fleet_starter';
}

export function isVehicleTypeAllowed(planId: PlanId, vehicleType: VehicleType): boolean {
  const plan = getPlan(planId);
  return plan.allowedVehicleTypes.includes(vehicleType);
}

export function getVehicleLimitDisplay(vehicleLimit: number): string {
  if (vehicleLimit === Infinity) return 'Unlimited';
  return `Up to ${vehicleLimit}`;
}

export function getUserLimitDisplay(userLimit: number): string {
  if (userLimit === Infinity) return 'Unlimited';
  if (userLimit === 1) return '1 user';
  return `Up to ${userLimit} users`;
}

export function planSupportsMultiUser(planId: PlanId): boolean {
  const plan = getPlan(planId);
  return plan.supportsMultiUser;
}
