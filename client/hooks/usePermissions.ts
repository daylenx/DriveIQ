/**
 * usePermissions.ts - Centralized Permission Management
 * 
 * Provides permission checking utilities for the app.
 * All permission-gated actions should use this hook.
 */

import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFamily } from '@/context/FamilyContext';
import { PLANS, planSupportsMultiUser } from '@/constants/plans';

export interface PermissionSet {
  canEditVehicle: (vehicleId: string) => boolean;
  canDeleteVehicle: (vehicleId: string) => boolean;
  canAddVehicle: boolean;
  canLogService: (vehicleId: string) => boolean;
  canUpdateOdometer: (vehicleId: string) => boolean;
  canManageFamily: boolean;
  canChangePlan: boolean;
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  isPrimaryUser: boolean;
  isViewOnly: boolean;
}

export function usePermissions(): PermissionSet {
  const { user } = useAuth();
  const { isPrimaryUser, userPermission, assignedVehicleIds } = useFamily();

  const currentPlan = user?.plan || 'free';
  const plan = PLANS[currentPlan] || PLANS.free;
  const supportsMultiUser = planSupportsMultiUser(currentPlan);
  const isViewOnly = userPermission === 'view_only';

  const permissions = useMemo<PermissionSet>(() => {
    const hasVehicleAccess = (vehicleId: string): boolean => {
      if (isPrimaryUser) return true;
      return assignedVehicleIds.includes(vehicleId);
    };

    const canEditVehicle = (vehicleId: string): boolean => {
      if (!hasVehicleAccess(vehicleId)) return false;
      if (isViewOnly) return false;
      return true;
    };

    const canDeleteVehicle = (vehicleId: string): boolean => {
      if (!isPrimaryUser) return false;
      return true;
    };

    const canLogService = (vehicleId: string): boolean => {
      if (!hasVehicleAccess(vehicleId)) return false;
      if (isViewOnly) return false;
      return true;
    };

    const canUpdateOdometer = (vehicleId: string): boolean => {
      if (!hasVehicleAccess(vehicleId)) return false;
      if (isViewOnly) return false;
      return true;
    };

    return {
      canEditVehicle,
      canDeleteVehicle,
      canAddVehicle: isPrimaryUser,
      canLogService,
      canUpdateOdometer,
      canManageFamily: isPrimaryUser && supportsMultiUser,
      canChangePlan: isPrimaryUser,
      canInviteMembers: isPrimaryUser && supportsMultiUser,
      canRemoveMembers: isPrimaryUser,
      isPrimaryUser,
      isViewOnly,
    };
  }, [isPrimaryUser, userPermission, assignedVehicleIds, isViewOnly, supportsMultiUser]);

  return permissions;
}
