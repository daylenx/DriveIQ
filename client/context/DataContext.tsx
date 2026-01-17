/**
 * DataContext.tsx - Core data management layer for DriveIQ
 * 
 * This context manages all vehicle, maintenance task, and service log data.
 * It uses Firestore real-time listeners (onSnapshot) to provide live updates
 * across all connected clients.
 * 
 * FIRESTORE COLLECTIONS:
 * - vehicles: User's registered vehicles with odometer readings
 * - maintenanceTasks: Scheduled maintenance items per vehicle
 * - serviceLogs: Historical record of completed maintenance
 * 
 * FIRESTORE INDEXES:
 * No composite indexes required - all queries filter by userId only.
 * Sorting is done client-side to avoid index complexity.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Vehicle, MaintenanceTask, ServiceLog, DashboardTask, Tip, PlanId } from '@/types';
import { PLANS, getSuggestedUpgrade } from '@/constants/plans';
import { PAYWALLS_ENABLED, DEV_PREVIEW_PAYWALL } from '@/constants/featureFlags';
import { defaultMaintenanceLibrary } from '@/data/maintenanceLibrary';
import Tips from '@/data/Tips.json';
import { useAuth } from './AuthContext';
import { generateId, getActiveVehicleId, setActiveVehicleId as setActiveVehicleIdStorage } from '@/lib/storage';

export interface CanAddVehicleResult {
  allowed: boolean;
  reason?: string;
  suggestedPlan?: PlanId;
}

interface DataContextType {
  vehicles: Vehicle[];
  activeVehicle: Vehicle | null;
  maintenanceTasks: MaintenanceTask[];
  serviceLogs: ServiceLog[];
  dashboardTasks: DashboardTask[];
  tipOfTheDay: Tip;
  isLoading: boolean;
  canAddVehicle: () => CanAddVehicleResult;
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'userId' | 'isActive' | 'createdAt' | 'updatedAt'>) => Promise<Vehicle>;
  updateVehicle: (vehicle: Vehicle) => Promise<void>;
  removeVehicle: (vehicleId: string) => Promise<void>;
  setActiveVehicle: (vehicleId: string | null) => Promise<void>;
  updateOdometer: (vehicleId: string, newOdometer: number) => Promise<void>;
  logService: (log: Omit<ServiceLog, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  removeServiceLog: (logId: string) => Promise<void>;
  refreshData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

/**
 * Selects the "Tip of the Day" based on the current day of year.
 * Uses modulo arithmetic to cycle through all tips annually.
 * This ensures users see different tips each day while providing
 * consistent content across app sessions on the same day.
 */
function getTipOfTheDay(): Tip {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  const tips = Tips as Tip[];
  return tips[dayOfYear % tips.length];
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeVehicleId, setActiveVehicleIdState] = useState<string | null>(null);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
  const [serviceLogs, setServiceLogs] = useState<ServiceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tipOfTheDay] = useState<Tip>(getTipOfTheDay());

  /**
   * Sets up real-time Firestore listeners for user data.
   * 
   * Listeners established for:
   * 1. Personal vehicles (userId == user.id)
   * 2. Fleet vehicles (fleetId == user's fleet) - when user is part of a fleet
   * 3. Personal maintenance tasks
   * 4. Fleet maintenance tasks - when user is part of a fleet
   * 5. Personal service logs
   * 6. Fleet service logs - when user is part of a fleet
   * 
   * All listeners automatically clean up on unmount or user/fleet change.
   */
  useEffect(() => {
    if (!user) {
      setVehicles([]);
      setMaintenanceTasks([]);
      setServiceLogs([]);
      setActiveVehicleIdState(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribers: (() => void)[] = [];
    
    let personalVehicles: Vehicle[] = [];
    let fleetVehicles: Vehicle[] = [];
    let personalTasks: MaintenanceTask[] = [];
    let fleetTasks: MaintenanceTask[] = [];
    let personalLogs: ServiceLog[] = [];
    let fleetLogs: ServiceLog[] = [];
    
    const userFleetId = user.fleetId;

    const mergeAndSetVehicles = () => {
      const allVehicles = [...personalVehicles, ...fleetVehicles];
      const uniqueVehicles = allVehicles.filter((v, i, arr) => 
        arr.findIndex(x => x.id === v.id) === i
      );
      uniqueVehicles.sort((a, b) => b.createdAt - a.createdAt);
      setVehicles(uniqueVehicles);
      
      getActiveVehicleId().then((activeId) => {
        if (activeId && uniqueVehicles.some((v) => v.id === activeId)) {
          setActiveVehicleIdState(activeId);
        } else if (uniqueVehicles.length > 0) {
          const firstId = uniqueVehicles[0].id;
          setActiveVehicleIdState(firstId);
          setActiveVehicleIdStorage(firstId);
        }
      });
    };
    
    const mergeAndSetTasks = () => {
      const allTasks = [...personalTasks, ...fleetTasks];
      const uniqueTasks = allTasks.filter((t, i, arr) => 
        arr.findIndex(x => x.id === t.id) === i
      );
      setMaintenanceTasks(uniqueTasks);
    };
    
    const mergeAndSetLogs = () => {
      const allLogs = [...personalLogs, ...fleetLogs];
      const uniqueLogs = allLogs.filter((l, i, arr) => 
        arr.findIndex(x => x.id === l.id) === i
      );
      uniqueLogs.sort((a, b) => b.date - a.date);
      setServiceLogs(uniqueLogs);
      setIsLoading(false);
    };

    const personalVehiclesQuery = query(
      collection(db, 'vehicles'),
      where('userId', '==', user.id)
    );

    const unsubPersonalVehicles = onSnapshot(personalVehiclesQuery, async (snapshot) => {
      const vehicleData: Vehicle[] = [];
      const vehiclesToBackfill: Vehicle[] = [];
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const vehicleDoc = {
          ...data,
          vehicleType: data.vehicleType || 'car',
        } as Vehicle;
        
        if (!vehicleDoc.lastOdometerUpdate) {
          vehicleDoc.lastOdometerUpdate = vehicleDoc.updatedAt || vehicleDoc.createdAt;
          vehiclesToBackfill.push(vehicleDoc);
        }
        
        vehicleData.push(vehicleDoc);
      });
      
      personalVehicles = vehicleData;
      mergeAndSetVehicles();
      
      if (vehiclesToBackfill.length > 0) {
        const batch = writeBatch(db);
        for (const v of vehiclesToBackfill) {
          batch.update(doc(db, 'vehicles', v.id), { lastOdometerUpdate: v.lastOdometerUpdate });
        }
        batch.commit().catch(console.error);
      }
    });
    unsubscribers.push(unsubPersonalVehicles);

    if (userFleetId) {
      const fleetVehiclesQuery = query(
        collection(db, 'vehicles'),
        where('fleetId', '==', userFleetId)
      );
      
      const unsubFleetVehicles = onSnapshot(fleetVehiclesQuery, (snapshot) => {
        const vehicleData: Vehicle[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          vehicleData.push({
            ...data,
            vehicleType: data.vehicleType || 'car',
          } as Vehicle);
        });
        fleetVehicles = vehicleData;
        mergeAndSetVehicles();
      }, (error) => {
        console.log('Fleet vehicles query not available:', error.message);
        fleetVehicles = [];
        mergeAndSetVehicles();
      });
      unsubscribers.push(unsubFleetVehicles);
    }

    const personalTasksQuery = query(
      collection(db, 'maintenanceTasks'),
      where('userId', '==', user.id)
    );

    const unsubPersonalTasks = onSnapshot(personalTasksQuery, (snapshot) => {
      const taskData: MaintenanceTask[] = [];
      snapshot.forEach((docItem) => {
        taskData.push(docItem.data() as MaintenanceTask);
      });
      personalTasks = taskData;
      mergeAndSetTasks();
    });
    unsubscribers.push(unsubPersonalTasks);

    if (userFleetId) {
      const fleetTasksQuery = query(
        collection(db, 'maintenanceTasks'),
        where('fleetId', '==', userFleetId)
      );
      
      const unsubFleetTasks = onSnapshot(fleetTasksQuery, (snapshot) => {
        const taskData: MaintenanceTask[] = [];
        snapshot.forEach((docItem) => {
          taskData.push(docItem.data() as MaintenanceTask);
        });
        fleetTasks = taskData;
        mergeAndSetTasks();
      }, (error) => {
        console.log('Fleet tasks query not available:', error.message);
        fleetTasks = [];
        mergeAndSetTasks();
      });
      unsubscribers.push(unsubFleetTasks);
    }

    const personalLogsQuery = query(
      collection(db, 'serviceLogs'),
      where('userId', '==', user.id)
    );

    const unsubPersonalLogs = onSnapshot(personalLogsQuery, (snapshot) => {
      const logData: ServiceLog[] = [];
      snapshot.forEach((docItem) => {
        logData.push(docItem.data() as ServiceLog);
      });
      personalLogs = logData;
      mergeAndSetLogs();
    });
    unsubscribers.push(unsubPersonalLogs);

    if (userFleetId) {
      const fleetLogsQuery = query(
        collection(db, 'serviceLogs'),
        where('fleetId', '==', userFleetId)
      );
      
      const unsubFleetLogs = onSnapshot(fleetLogsQuery, (snapshot) => {
        const logData: ServiceLog[] = [];
        snapshot.forEach((docItem) => {
          logData.push(docItem.data() as ServiceLog);
        });
        fleetLogs = logData;
        mergeAndSetLogs();
      }, (error) => {
        console.log('Fleet logs query not available:', error.message);
        fleetLogs = [];
        mergeAndSetLogs();
      });
      unsubscribers.push(unsubFleetLogs);
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user]);

  const activeVehicle = vehicles.find((v) => v.id === activeVehicleId) || null;

  /**
   * Computes dashboard-ready tasks with status indicators.
   * 
   * MAINTENANCE STATUS CALCULATION:
   * Each task can have two triggers - mileage-based and time-based.
   * Status is determined by whichever threshold is reached first:
   * 
   * OVERDUE: 
   *   - Miles remaining <= 0 (past nextDueOdometer), OR
   *   - Days remaining <= 0 (past nextDueDate)
   * 
   * DUE SOON:
   *   - Miles remaining <= 500 (within warning threshold), OR
   *   - Days remaining <= 14 (within 2-week warning window)
   * 
   * UPCOMING:
   *   - Neither overdue nor due soon conditions are met
   * 
   * Tasks are sorted by urgency: overdue first, then due soon, then upcoming.
   * Within each status group, tasks are sorted by miles remaining (closest first).
   */
  const dashboardTasks: DashboardTask[] = React.useMemo(() => {
    const now = Date.now();
    const tasks: DashboardTask[] = [];

    for (const task of maintenanceTasks) {
      const vehicle = vehicles.find((v) => v.id === task.vehicleId);
      if (!vehicle) continue;

      const vehicleName = vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
      
      const milesRemaining = task.nextDueOdometer 
        ? task.nextDueOdometer - vehicle.currentOdometer 
        : null;
      const daysRemaining = task.nextDueDate 
        ? Math.floor((task.nextDueDate - now) / (24 * 60 * 60 * 1000)) 
        : null;

      let status: DashboardTask['status'] = 'upcoming';
      
      const isOverdueMiles = milesRemaining !== null && milesRemaining <= 0;
      const isOverdueTime = daysRemaining !== null && daysRemaining <= 0;
      const isDueSoonMiles = milesRemaining !== null && milesRemaining <= 500;
      const isDueSoonTime = daysRemaining !== null && daysRemaining <= 14;

      const isEstimatedBaseline = task.baselineType === 'estimated';
      
      if (isOverdueMiles || isOverdueTime) {
        status = isEstimatedBaseline ? 'dueSoon' : 'overdue';
      } else if (isDueSoonMiles || isDueSoonTime) {
        status = 'dueSoon';
      }

      tasks.push({
        ...task,
        status,
        milesRemaining,
        daysRemaining,
        vehicleName,
      });
    }

    return tasks.sort((a, b) => {
      const statusOrder = { overdue: 0, dueSoon: 1, upcoming: 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return (a.milesRemaining || Infinity) - (b.milesRemaining || Infinity);
    });
  }, [maintenanceTasks, vehicles]);

  /**
   * Creates a new vehicle with default maintenance schedule.
   * 
   * When a vehicle is added, the system automatically creates
   * maintenance tasks from the default library (MaintenanceDefaults.json).
   * Initial nextDue values are calculated from the vehicle's current odometer
   * and the current date, using each task's interval settings.
   * 
   * Uses Firestore batch write to ensure atomic creation of
   * vehicle + all maintenance tasks together.
   */
  async function addVehicle(vehicleData: Omit<Vehicle, 'id' | 'userId' | 'isActive' | 'createdAt' | 'updatedAt'>): Promise<Vehicle> {
    if (!user) throw new Error('User not authenticated');

    const now = Date.now();
    const vehicleId = generateId();
    
    const isFleetUser = user.fleetId && user.accountType === 'fleet';
    const effectiveFleetId = vehicleData.fleetId || (isFleetUser ? user.fleetId : undefined);
    const effectiveOwnerType = effectiveFleetId ? 'fleet' : (vehicleData.ownerType || 'personal');
    
    const vehicle: Vehicle = {
      ...vehicleData,
      id: vehicleId,
      userId: user.id,
      isActive: vehicles.length === 0,
      createdAt: now,
      updatedAt: now,
      lastOdometerUpdate: now,
      ownerType: effectiveOwnerType,
      ...(effectiveFleetId && { fleetId: effectiveFleetId }),
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'vehicles', vehicleId), vehicle);

    const applicableTasks = defaultMaintenanceLibrary.filter((item) => {
      if (!item.vehicleTypes) return true;
      return item.vehicleTypes.includes(vehicleData.vehicleType);
    });

    for (const item of applicableTasks) {
      const taskId = generateId();
      const task: MaintenanceTask = {
        id: taskId,
        vehicleId: vehicleId,
        userId: user.id,
        typeId: item.typeId,
        name: item.name,
        category: item.category,
        description: item.description,
        milesInterval: item.milesInterval,
        monthsInterval: item.monthsInterval,
        lastServiceOdometer: null,
        lastServiceDate: null,
        nextDueOdometer: vehicleData.currentOdometer + item.milesInterval,
        nextDueDate: now + item.monthsInterval * 30 * 24 * 60 * 60 * 1000,
        baselineType: 'estimated',
        createdAt: now,
        updatedAt: now,
        ownerType: effectiveOwnerType,
        ...(effectiveFleetId && { fleetId: effectiveFleetId }),
      };
      batch.set(doc(db, 'maintenanceTasks', taskId), task);
    }

    await batch.commit();

    if (!activeVehicleId) {
      setActiveVehicleIdState(vehicleId);
      await setActiveVehicleIdStorage(vehicleId);
    }

    return vehicle;
  }

  async function updateVehicle(vehicle: Vehicle): Promise<void> {
    const existingVehicle = vehicles.find((v) => v.id === vehicle.id);
    const updatedVehicle = {
      ...vehicle,
      updatedAt: Date.now(),
      lastOdometerUpdate: vehicle.lastOdometerUpdate || existingVehicle?.lastOdometerUpdate || vehicle.createdAt,
    };
    await setDoc(doc(db, 'vehicles', vehicle.id), updatedVehicle);
  }

  /**
   * Removes a vehicle and all associated data.
   * 
   * Cascading delete removes:
   * - The vehicle document
   * - All maintenance tasks for this vehicle
   * - All service logs for this vehicle
   * 
   * Uses batch write for atomic deletion to prevent orphaned records.
   */
  async function removeVehicle(vehicleId: string): Promise<void> {
    const batch = writeBatch(db);
    
    batch.delete(doc(db, 'vehicles', vehicleId));
    
    const vehicleTasks = maintenanceTasks.filter((t) => t.vehicleId === vehicleId);
    for (const task of vehicleTasks) {
      batch.delete(doc(db, 'maintenanceTasks', task.id));
    }
    
    const vehicleLogs = serviceLogs.filter((l) => l.vehicleId === vehicleId);
    for (const log of vehicleLogs) {
      batch.delete(doc(db, 'serviceLogs', log.id));
    }

    await batch.commit();

    if (activeVehicleId === vehicleId) {
      const remaining = vehicles.filter((v) => v.id !== vehicleId);
      const newActiveId = remaining.length > 0 ? remaining[0].id : null;
      setActiveVehicleIdState(newActiveId);
      await setActiveVehicleIdStorage(newActiveId);
    }
  }

  async function setActiveVehicle(vehicleId: string | null): Promise<void> {
    setActiveVehicleIdState(vehicleId);
    await setActiveVehicleIdStorage(vehicleId);
  }

  /**
   * Updates a vehicle's odometer reading.
   * 
   * This is the manual odometer update feature - users enter their
   * current mileage directly. The app does NOT use GPS or motion
   * tracking to automatically update odometer values.
   * 
   * // TODO: Future feature - VIN decode integration could pre-populate
   * // estimated mileage based on vehicle history reports.
   */
  async function updateOdometer(vehicleId: string, newOdometer: number): Promise<void> {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return;

    const now = Date.now();
    const updatedVehicle: Vehicle = {
      ...vehicle,
      currentOdometer: newOdometer,
      updatedAt: now,
      lastOdometerUpdate: now,
    };
    await setDoc(doc(db, 'vehicles', vehicleId), updatedVehicle);
  }

  /**
   * Logs a completed service and updates the associated maintenance task.
   * 
   * When a service is logged:
   * 1. Creates a ServiceLog record for history
   * 2. Updates the MaintenanceTask with new lastService values
   * 3. Calculates new nextDue values based on current odometer + interval
   * 4. If service odometer > vehicle's current reading, updates vehicle too
   * 
   * The "whichever comes first" logic for maintenance reminders is
   * recalculated here - nextDueOdometer and nextDueDate are both set
   * based on the service odometer/date plus their respective intervals.
   * 
   * // TODO: Future feature - Notifications integration would schedule
   * // push notifications when nextDue thresholds approach.
   */
  async function logService(logData: Omit<ServiceLog, 'id' | 'userId' | 'createdAt'>): Promise<void> {
    if (!user) throw new Error('User not authenticated');

    const logId = generateId();
    const relatedTask = maintenanceTasks.find((t) => t.id === logData.taskId);
    const vehicle = vehicles.find((v) => v.id === logData.vehicleId);
    
    const isFleetUser = user.fleetId && user.accountType === 'fleet';
    const effectiveFleetId = logData.fleetId || vehicle?.fleetId || (isFleetUser ? user.fleetId : undefined);
    const effectiveOwnerType = effectiveFleetId ? 'fleet' : (logData.ownerType || 'personal');
    
    const log: ServiceLog = {
      id: logId,
      userId: user.id,
      vehicleId: logData.vehicleId,
      taskId: logData.taskId,
      taskName: logData.taskName,
      category: relatedTask?.category || logData.category,
      date: logData.date,
      odometer: logData.odometer,
      createdAt: Date.now(),
      ownerType: effectiveOwnerType,
      ...(effectiveFleetId && { fleetId: effectiveFleetId }),
    };
    if (logData.notes) log.notes = logData.notes;
    if (logData.cost !== undefined) log.cost = logData.cost;
    if (logData.receiptUri) log.receiptUri = logData.receiptUri;

    const batch = writeBatch(db);
    batch.set(doc(db, 'serviceLogs', logId), log);

    const task = maintenanceTasks.find((t) => t.id === logData.taskId);
    if (task) {
      const now = Date.now();
      const updatedTask: MaintenanceTask = {
        ...task,
        lastServiceOdometer: logData.odometer,
        lastServiceDate: logData.date,
        nextDueOdometer: logData.odometer + task.milesInterval,
        nextDueDate: logData.date + task.monthsInterval * 30 * 24 * 60 * 60 * 1000,
        baselineType: 'confirmed',
        updatedAt: now,
      };
      batch.set(doc(db, 'maintenanceTasks', task.id), updatedTask);

      const vehicle = vehicles.find((v) => v.id === logData.vehicleId);
      if (vehicle && logData.odometer > vehicle.currentOdometer) {
        const updatedVehicle: Vehicle = {
          ...vehicle,
          currentOdometer: logData.odometer,
          updatedAt: now,
        };
        batch.set(doc(db, 'vehicles', vehicle.id), updatedVehicle);
      }
    }

    await batch.commit();
  }

  async function removeServiceLog(logId: string): Promise<void> {
    await deleteDoc(doc(db, 'serviceLogs', logId));
  }

  function refreshData(): void {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 500);
  }

  /**
   * Checks if the user can add another vehicle based on their plan limits.
   * Returns allowed status, reason if blocked, and suggested upgrade plan.
   * 
   * Behavior by flag combination:
   * - PAYWALLS_ENABLED=true: Full enforcement (production)
   * - PAYWALLS_ENABLED=false, DEV_PREVIEW_PAYWALL=true: Show gating with bypass option (testing)
   * - PAYWALLS_ENABLED=false, DEV_PREVIEW_PAYWALL=false: No enforcement
   */
  function canAddVehicle(): CanAddVehicleResult {
    if (!PAYWALLS_ENABLED && !DEV_PREVIEW_PAYWALL) {
      return { allowed: true };
    }

    const currentPlan = user?.plan || 'free';
    const plan = PLANS[currentPlan] || PLANS.free;
    const vehicleLimit = user?.vehicleLimit || plan.vehicleLimit;
    const accountType = user?.accountType || 'personal';
    const limitDisplay = vehicleLimit === Infinity ? 'unlimited vehicles' : `${vehicleLimit} vehicle${vehicleLimit === 1 ? '' : 's'}`;

    if (vehicleLimit !== Infinity && vehicles.length >= vehicleLimit) {
      const suggestedPlan = getSuggestedUpgrade(currentPlan, accountType);
      let reason = `You have reached your limit of ${limitDisplay} on the ${plan.name} plan.`;
      
      if (currentPlan === 'free') {
        reason = `You've reached your free vehicle limit. Upgrade to Personal Pro to manage multiple vehicles — including cars, pickups, and semi-trucks.`;
      }
      
      return {
        allowed: false,
        reason,
        suggestedPlan: suggestedPlan || undefined,
      };
    }

    return { allowed: true };
  }

  return (
    <DataContext.Provider
      value={{
        vehicles,
        activeVehicle,
        maintenanceTasks,
        serviceLogs,
        dashboardTasks,
        tipOfTheDay,
        isLoading,
        canAddVehicle,
        addVehicle,
        updateVehicle,
        removeVehicle,
        setActiveVehicle,
        updateOdometer,
        logService,
        removeServiceLog,
        refreshData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

/**
 * Hook to access data context.
 * Must be used within a DataProvider.
 */
export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
