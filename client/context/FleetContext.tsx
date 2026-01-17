/**
 * FleetContext.tsx - Fleet Organization Management
 * 
 * Manages fleet organizations, members, and role-based access control.
 * Works alongside AuthContext and DataContext for multi-user fleet functionality.
 * 
 * FIRESTORE STRUCTURE:
 * - fleets/{fleetId}: Fleet organizations
 * - fleets/{fleetId}/members/{userId}: Fleet members (subcollection)
 * - fleetInvites: Pending invitations
 * - users/{userId}.fleetId: User's current fleet (stored on user profile)
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
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Fleet, FleetMember, FleetInvite, FleetRole } from '@/types';
import { useAuth } from './AuthContext';

interface FleetContextType {
  fleet: Fleet | null;
  fleetMembers: FleetMember[];
  pendingInvites: FleetInvite[];
  myFleetMembership: FleetMember | null;
  myPendingInvite: FleetInvite | null;
  isLoading: boolean;
  isFleetAdmin: boolean;
  isFleetDriver: boolean;
  myFleetRole: FleetRole | null;
  membersCount: number;
  vehiclesUsed: number;
  vehicleLimit: number;
  canAddVehicle: boolean;
  createFleet: (name: string) => Promise<string>;
  inviteMember: (email: string, role: FleetRole) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: FleetRole) => Promise<void>;
  cancelInvite: (inviteId: string) => Promise<void>;
  acceptInvite: () => Promise<void>;
  declineInvite: () => Promise<void>;
  leaveFleet: () => Promise<void>;
}

const FleetContext = createContext<FleetContextType | undefined>(undefined);

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function FleetProvider({ children }: { children: ReactNode }) {
  const { user, refreshUserProfile } = useAuth();
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [fleetMembers, setFleetMembers] = useState<FleetMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<FleetInvite[]>([]);
  const [myFleetMembership, setMyFleetMembership] = useState<FleetMember | null>(null);
  const [myPendingInvite, setMyPendingInvite] = useState<FleetInvite | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [vehiclesUsed, setVehiclesUsed] = useState(0);

  const isFleetAdmin = user?.fleetRole === 'admin' || (user?.accountType === 'fleet' && fleet?.createdBy === user?.id);
  const isFleetDriver = user?.fleetRole === 'driver';
  const myFleetRole = user?.fleetRole || (isFleetAdmin ? 'admin' : null);
  const membersCount = fleetMembers.length;
  const vehicleLimit = fleet?.vehicleLimit || 0;
  const canAddVehicle = isFleetAdmin && vehiclesUsed < vehicleLimit;

  useEffect(() => {
    if (!user) {
      setFleet(null);
      setFleetMembers([]);
      setPendingInvites([]);
      setMyFleetMembership(null);
      setMyPendingInvite(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribers: (() => void)[] = [];

    const myInviteQuery = query(
      collection(db, 'fleetInvites'),
      where('email', '==', user.email.toLowerCase())
    );
    const unsubMyInvite = onSnapshot(
      myInviteQuery,
      (snapshot) => {
        const invite = snapshot.docs.length > 0
          ? { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as FleetInvite
          : null;
        setMyPendingInvite(invite);
      },
      (error) => {
        console.log('FleetContext: fleetInvites query error');
        setMyPendingInvite(null);
      }
    );
    unsubscribers.push(unsubMyInvite);

    if (user.fleetId) {
      const fleetRef = doc(db, 'fleets', user.fleetId);
      const unsubFleet = onSnapshot(
        fleetRef,
        (fleetDoc) => {
          if (fleetDoc.exists()) {
            setFleet({ ...fleetDoc.data(), id: fleetDoc.id } as Fleet);
          } else {
            setFleet(null);
          }
        },
        () => setFleet(null)
      );
      unsubscribers.push(unsubFleet);

      const membersRef = collection(db, 'fleets', user.fleetId, 'members');
      const unsubMembers = onSnapshot(
        membersRef,
        async (membersSnapshot) => {
          const members = membersSnapshot.docs.map((d) => ({ ...d.data(), id: d.id } as FleetMember));
          
          const membersWithProfiles = await Promise.all(
            members.map(async (member) => {
              try {
                const userDoc = await getDoc(doc(db, 'users', member.userId));
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  return {
                    ...member,
                    displayName: userData.displayName || 'Unknown',
                    email: userData.email || '',
                  };
                }
              } catch (error) {
                console.log('Failed to fetch user profile for member:', member.userId);
              }
              return member;
            })
          );
          
          setFleetMembers(membersWithProfiles);
          const myMembership = membersWithProfiles.find((m) => m.userId === user.id) || null;
          setMyFleetMembership(myMembership);
        },
        () => {
          setFleetMembers([]);
          setMyFleetMembership(null);
        }
      );
      unsubscribers.push(unsubMembers);

      const invitesQuery = query(
        collection(db, 'fleetInvites'),
        where('fleetId', '==', user.fleetId)
      );
      const unsubInvites = onSnapshot(
        invitesQuery,
        (invitesSnapshot) => {
          setPendingInvites(invitesSnapshot.docs.map((d) => ({ ...d.data(), id: d.id } as FleetInvite)));
        },
        () => setPendingInvites([])
      );
      unsubscribers.push(unsubInvites);

      const vehiclesQuery = query(
        collection(db, 'vehicles'),
        where('fleetId', '==', user.fleetId)
      );
      const unsubVehicles = onSnapshot(
        vehiclesQuery,
        (vehiclesSnapshot) => {
          setVehiclesUsed(vehiclesSnapshot.docs.length);
        },
        () => setVehiclesUsed(0)
      );
      unsubscribers.push(unsubVehicles);

      setIsLoading(false);
    } else {
      setFleet(null);
      setFleetMembers([]);
      setPendingInvites([]);
      setMyFleetMembership(null);
      setIsLoading(false);
    }

    return () => unsubscribers.forEach((u) => u());
  }, [user?.id, user?.email, user?.fleetId]);

  async function createFleet(name: string): Promise<string> {
    if (!user) throw new Error('User not authenticated');

    const plan = user.plan === 'fleet_pro' ? 'fleet_pro' : 'fleet_starter';
    const vehicleLimitValue = plan === 'fleet_pro' ? 999 : 20;

    const fleetId = generateId();
    const newFleet: Fleet = {
      id: fleetId,
      name,
      createdAt: Date.now(),
      createdBy: user.id,
      plan,
      vehicleLimit: vehicleLimitValue,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'fleets', fleetId), newFleet);

    const ownerMember: FleetMember = {
      id: user.id,
      fleetId,
      userId: user.id,
      role: 'admin',
      createdAt: Date.now(),
    };
    batch.set(doc(db, 'fleets', fleetId, 'members', user.id), ownerMember);

    batch.update(doc(db, 'users', user.id), {
      fleetId,
      fleetRole: 'admin',
      accountType: 'fleet',
    });

    await batch.commit();
    
    await migrateUserDataToFleet(user.id, fleetId);
    await refreshUserProfile();

    return fleetId;
  }
  
  async function migrateUserDataToFleet(userId: string, fleetId: string): Promise<void> {
    const vehiclesQuery = query(
      collection(db, 'vehicles'),
      where('userId', '==', userId)
    );
    const vehiclesSnapshot = await getDocs(vehiclesQuery);
    
    const tasksQuery = query(
      collection(db, 'maintenanceTasks'),
      where('userId', '==', userId)
    );
    const tasksSnapshot = await getDocs(tasksQuery);
    
    const logsQuery = query(
      collection(db, 'serviceLogs'),
      where('userId', '==', userId)
    );
    const logsSnapshot = await getDocs(logsQuery);
    
    const migrationBatch = writeBatch(db);
    
    vehiclesSnapshot.docs.forEach((vehicleDoc) => {
      migrationBatch.update(doc(db, 'vehicles', vehicleDoc.id), {
        fleetId,
        ownerType: 'fleet',
      });
    });
    
    tasksSnapshot.docs.forEach((taskDoc) => {
      migrationBatch.update(doc(db, 'maintenanceTasks', taskDoc.id), {
        fleetId,
      });
    });
    
    logsSnapshot.docs.forEach((logDoc) => {
      migrationBatch.update(doc(db, 'serviceLogs', logDoc.id), {
        fleetId,
      });
    });
    
    if (vehiclesSnapshot.docs.length > 0 || tasksSnapshot.docs.length > 0 || logsSnapshot.docs.length > 0) {
      await migrationBatch.commit();
    }
  }

  async function inviteMember(email: string, role: FleetRole): Promise<void> {
    if (!user || !fleet) throw new Error('Fleet not initialized');
    if (!isFleetAdmin) throw new Error('Only admins can invite members');

    const normalizedEmail = email.toLowerCase().trim();

    const existingInviteQuery = query(
      collection(db, 'fleetInvites'),
      where('fleetId', '==', fleet.id),
      where('email', '==', normalizedEmail)
    );
    const existingInvites = await getDocs(existingInviteQuery);
    if (!existingInvites.empty) {
      throw new Error('This email already has a pending invitation');
    }

    const inviteId = generateId();
    const invite: FleetInvite = {
      id: inviteId,
      fleetId: fleet.id,
      fleetName: fleet.name,
      email: normalizedEmail,
      role,
      invitedAt: Date.now(),
      invitedBy: user.id,
    };

    await setDoc(doc(db, 'fleetInvites', inviteId), invite);
  }

  async function removeMember(memberId: string): Promise<void> {
    if (!user || !fleet) throw new Error('Fleet not initialized');
    if (!isFleetAdmin) throw new Error('Only admins can remove members');

    const memberToRemove = fleetMembers.find((m) => m.id === memberId);
    if (!memberToRemove) throw new Error('Member not found');
    if (memberToRemove.userId === user.id) throw new Error('Cannot remove yourself');

    const batch = writeBatch(db);
    batch.delete(doc(db, 'fleets', fleet.id, 'members', memberId));
    batch.update(doc(db, 'users', memberToRemove.userId), {
      fleetId: null,
      fleetRole: null,
      accountType: 'personal',
    });
    await batch.commit();
  }

  async function updateMemberRole(memberId: string, role: FleetRole): Promise<void> {
    if (!user || !fleet) throw new Error('Fleet not initialized');
    if (!isFleetAdmin) throw new Error('Only admins can update roles');

    const memberToUpdate = fleetMembers.find((m) => m.id === memberId);
    if (!memberToUpdate) throw new Error('Member not found');
    if (memberToUpdate.userId === user.id) throw new Error('Cannot change your own role');

    const batch = writeBatch(db);
    batch.update(doc(db, 'fleets', fleet.id, 'members', memberId), { role });
    batch.update(doc(db, 'users', memberToUpdate.userId), { fleetRole: role });
    await batch.commit();
  }

  async function cancelInvite(inviteId: string): Promise<void> {
    if (!user || !fleet) throw new Error('Fleet not initialized');
    if (!isFleetAdmin) throw new Error('Only admins can cancel invites');

    await deleteDoc(doc(db, 'fleetInvites', inviteId));
  }

  async function acceptInvite(): Promise<void> {
    if (!user || !myPendingInvite) throw new Error('No pending invite');

    const newMember: FleetMember = {
      id: user.id,
      fleetId: myPendingInvite.fleetId,
      userId: user.id,
      role: myPendingInvite.role,
      createdAt: Date.now(),
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'fleets', myPendingInvite.fleetId, 'members', user.id), newMember);
    batch.delete(doc(db, 'fleetInvites', myPendingInvite.id));
    batch.update(doc(db, 'users', user.id), {
      fleetId: myPendingInvite.fleetId,
      fleetRole: myPendingInvite.role,
      accountType: 'fleet',
    });
    await batch.commit();
    
    await refreshUserProfile();
  }

  async function declineInvite(): Promise<void> {
    if (!myPendingInvite) throw new Error('No pending invite');

    await deleteDoc(doc(db, 'fleetInvites', myPendingInvite.id));
  }

  async function leaveFleet(): Promise<void> {
    if (!user || !fleet) throw new Error('Not a fleet member');
    if (fleet.createdBy === user.id) throw new Error('Fleet owner cannot leave. Delete the fleet instead.');

    const batch = writeBatch(db);
    batch.delete(doc(db, 'fleets', fleet.id, 'members', user.id));
    batch.update(doc(db, 'users', user.id), {
      fleetId: null,
      fleetRole: null,
      accountType: 'personal',
    });
    await batch.commit();
    
    await refreshUserProfile();
  }

  const value = useMemo(
    () => ({
      fleet,
      fleetMembers,
      pendingInvites,
      myFleetMembership,
      myPendingInvite,
      isLoading,
      isFleetAdmin,
      isFleetDriver,
      myFleetRole,
      membersCount,
      vehiclesUsed,
      vehicleLimit,
      canAddVehicle,
      createFleet,
      inviteMember,
      removeMember,
      updateMemberRole,
      cancelInvite,
      acceptInvite,
      declineInvite,
      leaveFleet,
    }),
    [
      fleet,
      fleetMembers,
      pendingInvites,
      myFleetMembership,
      myPendingInvite,
      isLoading,
      isFleetAdmin,
      isFleetDriver,
      myFleetRole,
      membersCount,
      vehiclesUsed,
      vehicleLimit,
      canAddVehicle,
    ]
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

export function useFleet() {
  const context = useContext(FleetContext);
  if (context === undefined) {
    throw new Error('useFleet must be used within a FleetProvider');
  }
  return context;
}
