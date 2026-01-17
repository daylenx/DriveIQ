/**
 * FamilyContext.tsx - Family/Team Membership Management
 * 
 * Manages family plan members, invitations, and permissions.
 * Works alongside AuthContext to provide multi-user functionality.
 * 
 * FIRESTORE COLLECTIONS:
 * - familyMemberships: Links primary users to their members
 * - familyInvites: Pending invitations (email + token)
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FamilyMember, PermissionLevel, UserRole } from '@/types';
import { useAuth } from './AuthContext';
import { PLANS, planSupportsMultiUser } from '@/constants/plans';

interface FamilyInvite {
  id: string;
  primaryUserId: string;
  email: string;
  permission: PermissionLevel;
  assignedVehicleIds: string[];
  createdAt: number;
  expiresAt: number;
}

interface FamilyContextType {
  familyMembers: FamilyMember[];
  pendingInvites: FamilyInvite[];
  myPendingInvite: FamilyInvite | null;
  isLoading: boolean;
  isPrimaryUser: boolean;
  userRole: UserRole;
  userPermission: PermissionLevel;
  primaryUserId: string | null;
  assignedVehicleIds: string[];
  membersUsed: number;
  memberLimit: number;
  canAddMember: boolean;
  inviteMember: (email: string, permission: PermissionLevel, vehicleIds: string[]) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  updateMemberPermission: (memberId: string, permission: PermissionLevel) => Promise<void>;
  updateMemberVehicles: (memberId: string, vehicleIds: string[]) => Promise<void>;
  cancelInvite: (inviteId: string) => Promise<void>;
  acceptInvite: () => Promise<void>;
  declineInvite: () => Promise<void>;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<FamilyInvite[]>([]);
  const [myMembership, setMyMembership] = useState<FamilyMember | null>(null);
  const [myPendingInvite, setMyPendingInvite] = useState<FamilyInvite | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentPlan = user?.plan || 'free';
  const plan = PLANS[currentPlan] || PLANS.free;
  const supportsMultiUser = planSupportsMultiUser(currentPlan);

  const isPrimaryUser = user?.role !== 'member';
  const userRole: UserRole = user?.role || 'primary';
  const userPermission: PermissionLevel = myMembership?.permission || 'full_access';
  const primaryUserId = isPrimaryUser ? user?.id || null : user?.primaryUserId || null;
  const assignedVehicleIds = myMembership?.assignedVehicleIds || [];

  const membersUsed = familyMembers.filter(m => m.status === 'active').length + 1;
  const memberLimit = plan.userLimit;
  const canAddMember = supportsMultiUser && (memberLimit === Infinity || membersUsed < memberLimit);

  useEffect(() => {
    if (!user) {
      setFamilyMembers([]);
      setPendingInvites([]);
      setMyMembership(null);
      setMyPendingInvite(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribers: (() => void)[] = [];

    const myInviteQuery = query(
      collection(db, 'familyInvites'),
      where('email', '==', user.email.toLowerCase())
    );
    const unsubMyInvite = onSnapshot(myInviteQuery, (snapshot) => {
      const validInvite = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as FamilyInvite))
        .find(i => i.expiresAt > Date.now());
      setMyPendingInvite(validInvite || null);
    });
    unsubscribers.push(unsubMyInvite);

    if (isPrimaryUser && !user.primaryUserId) {
      const membersQuery = query(
        collection(db, 'familyMemberships'),
        where('primaryUserId', '==', user.id)
      );
      const unsubMembers = onSnapshot(membersQuery, (snapshot) => {
        const members = snapshot.docs.map(doc => doc.data() as FamilyMember);
        setFamilyMembers(members);
      });
      unsubscribers.push(unsubMembers);

      const invitesQuery = query(
        collection(db, 'familyInvites'),
        where('primaryUserId', '==', user.id)
      );
      const unsubInvites = onSnapshot(invitesQuery, (snapshot) => {
        const invites = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FamilyInvite));
        setPendingInvites(invites.filter(i => i.expiresAt > Date.now()));
      });
      unsubscribers.push(unsubInvites);
    } else if (user.primaryUserId) {
      const myMembershipQuery = query(
        collection(db, 'familyMemberships'),
        where('memberId', '==', user.id),
        where('primaryUserId', '==', user.primaryUserId)
      );
      const unsubMembership = onSnapshot(myMembershipQuery, (snapshot) => {
        if (!snapshot.empty) {
          setMyMembership(snapshot.docs[0].data() as FamilyMember);
        }
      });
      unsubscribers.push(unsubMembership);
    }

    setIsLoading(false);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user, isPrimaryUser]);

  async function inviteMember(email: string, permission: PermissionLevel, vehicleIds: string[]) {
    if (!user || !isPrimaryUser || !canAddMember) {
      throw new Error('Cannot invite member');
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    const existingInvite = pendingInvites.find(i => i.email === normalizedEmail);
    if (existingInvite) {
      throw new Error('An invitation has already been sent to this email');
    }

    const existingMember = familyMembers.find(m => m.memberEmail === normalizedEmail);
    if (existingMember) {
      throw new Error('This user is already a member');
    }

    const invite: FamilyInvite = {
      id: generateId(),
      primaryUserId: user.id,
      email: normalizedEmail,
      permission,
      assignedVehicleIds: vehicleIds,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    await setDoc(doc(db, 'familyInvites', invite.id), invite);
  }

  async function removeMember(memberId: string) {
    if (!user || !isPrimaryUser) {
      throw new Error('Only primary user can remove members');
    }

    const member = familyMembers.find(m => m.memberId === memberId);
    if (!member) {
      throw new Error('Member not found');
    }

    const batch = writeBatch(db);
    batch.delete(doc(db, 'familyMemberships', member.id));
    
    const memberUserDoc = doc(db, 'users', memberId);
    batch.update(memberUserDoc, {
      role: 'primary',
      primaryUserId: null,
    });

    await batch.commit();
  }

  async function updateMemberPermission(memberId: string, permission: PermissionLevel) {
    if (!user || !isPrimaryUser) {
      throw new Error('Only primary user can update permissions');
    }

    const member = familyMembers.find(m => m.memberId === memberId);
    if (!member) {
      throw new Error('Member not found');
    }

    await setDoc(doc(db, 'familyMemberships', member.id), {
      ...member,
      permission,
    }, { merge: true });
  }

  async function updateMemberVehicles(memberId: string, vehicleIds: string[]) {
    if (!user || !isPrimaryUser) {
      throw new Error('Only primary user can update vehicle assignments');
    }

    const member = familyMembers.find(m => m.memberId === memberId);
    if (!member) {
      throw new Error('Member not found');
    }

    await setDoc(doc(db, 'familyMemberships', member.id), {
      ...member,
      assignedVehicleIds: vehicleIds,
    }, { merge: true });
  }

  async function cancelInvite(inviteId: string) {
    if (!user || !isPrimaryUser) {
      throw new Error('Only primary user can cancel invites');
    }

    await deleteDoc(doc(db, 'familyInvites', inviteId));
  }

  async function acceptInvite() {
    if (!user || !myPendingInvite) {
      throw new Error('No pending invite to accept');
    }

    const invite = myPendingInvite;
    
    if (invite.expiresAt < Date.now()) {
      await deleteDoc(doc(db, 'familyInvites', invite.id));
      setMyPendingInvite(null);
      throw new Error('Invite has expired');
    }

    const membership: FamilyMember = {
      id: generateId(),
      primaryUserId: invite.primaryUserId,
      memberId: user.id,
      memberEmail: user.email,
      memberDisplayName: user.displayName,
      permission: invite.permission,
      assignedVehicleIds: invite.assignedVehicleIds,
      invitedAt: invite.createdAt,
      joinedAt: Date.now(),
      status: 'active',
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'familyMemberships', membership.id), membership);
    batch.delete(doc(db, 'familyInvites', invite.id));
    batch.update(doc(db, 'users', user.id), {
      role: 'member',
      primaryUserId: invite.primaryUserId,
    });

    await batch.commit();
    setMyPendingInvite(null);
  }

  async function declineInvite() {
    if (!user || !myPendingInvite) {
      throw new Error('No pending invite to decline');
    }

    await deleteDoc(doc(db, 'familyInvites', myPendingInvite.id));
    setMyPendingInvite(null);
  }

  const value = useMemo(() => ({
    familyMembers,
    pendingInvites,
    myPendingInvite,
    isLoading,
    isPrimaryUser,
    userRole,
    userPermission,
    primaryUserId,
    assignedVehicleIds,
    membersUsed,
    memberLimit,
    canAddMember,
    inviteMember,
    removeMember,
    updateMemberPermission,
    updateMemberVehicles,
    cancelInvite,
    acceptInvite,
    declineInvite,
  }), [
    familyMembers,
    pendingInvites,
    myPendingInvite,
    isLoading,
    isPrimaryUser,
    userRole,
    userPermission,
    primaryUserId,
    assignedVehicleIds,
    membersUsed,
    memberLimit,
    canAddMember,
  ]);

  return (
    <FamilyContext.Provider value={value}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (context === undefined) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
}
