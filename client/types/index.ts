/**
 * DriveIQ Type Definitions
 * 
 * This file defines all data models used throughout the application.
 * These types map directly to Firestore document structures.
 */

/**
 * User profile stored in Firestore 'users' collection.
 * Created during registration and updated when user changes settings.
 */
/**
 * Account type indicating personal or fleet usage.
 */
export type AccountType = 'personal' | 'fleet';

/**
 * Vehicle type categories.
 * - car: Passenger cars, sedans, SUVs, minivans
 * - pickup: Pickup trucks, light trucks
 * - semi: Semi-trucks, commercial trucks, big rigs
 */
export type VehicleType = 'car' | 'pickup' | 'semi';

/**
 * Odometer unit for each vehicle.
 * - mi: Miles (default, US standard)
 * - km: Kilometers (metric)
 */
export type OdometerUnit = 'mi' | 'km';

/**
 * Fleet role for multi-user fleet accounts.
 * - admin: Full access to manage vehicles, members, and view dashboard
 * - driver: Can update odometer and create service logs for assigned vehicles
 */
export type FleetRole = 'admin' | 'driver';

/**
 * Owner type for vehicles, tasks, and logs.
 * - personal: Owned by individual user
 * - fleet: Owned by a fleet organization
 */
export type OwnerType = 'personal' | 'fleet';

/**
 * Available plan identifiers.
 */
export type PlanId = 'free' | 'personal_pro' | 'family' | 'fleet_starter' | 'fleet_pro';

/**
 * User role within a family/team account.
 * - primary: Account owner with full control
 * - member: Invited user with assigned permissions
 */
export type UserRole = 'primary' | 'member';

/**
 * Permission level for family/team members.
 * - view_only: Can view vehicles, logs, and reminders but cannot edit
 * - full_access: Can add service logs, update odometer, manage assigned vehicles
 */
export type PermissionLevel = 'view_only' | 'full_access';

export interface User {
  id: string;
  email: string;
  displayName: string;
  showTips: boolean;
  themeMode: 'light' | 'dark' | 'pink';
  createdAt: number;
  updatedAt?: number;
  accountType?: AccountType;
  plan?: PlanId;
  vehicleLimit?: number;
  userLimit?: number;
  isLifetime?: boolean;
  role?: UserRole;
  primaryUserId?: string;
  disableOdometerReminders?: boolean;
  fleetId?: string;
  fleetRole?: FleetRole;
}

/**
 * Family/Team member relationship stored in Firestore 'familyMembers' collection.
 * Links a sub-user to the primary account holder.
 */
export interface FamilyMember {
  id: string;
  primaryUserId: string;
  memberId: string;
  memberEmail: string;
  memberDisplayName: string;
  permission: PermissionLevel;
  assignedVehicleIds: string[];
  invitedAt: number;
  joinedAt?: number;
  status: 'pending' | 'active';
}

/**
 * Vehicle record stored in Firestore 'vehicles' collection.
 * 
 * Key design notes:
 * - currentOdometer is MANUALLY updated by users (no GPS tracking)
 * - nickname provides a friendly display name (defaults to year make model)
 * - vin is optional but enables future VIN decode features
 * 
 * // TODO: Future feature - Add vinDecodeData field for cached VIN lookup results
 * // TODO: Future feature - Add recallAlerts array for NHTSA recall notifications
 */
export interface Vehicle {
  id: string;
  userId?: string;
  nickname: string;
  vehicleType: VehicleType;
  year: number;
  make: string;
  model: string;
  trim?: string;
  vin?: string;
  currentOdometer: number;
  odometerUnit: OdometerUnit;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  lastOdometerUpdate?: number;
  ownerType: OwnerType;
  fleetId?: string;
  assignedDriverIds?: string[];
}

/**
 * Template for default maintenance items.
 * Loaded from MaintenanceDefaults.json when a vehicle is created.
 * Each item becomes a MaintenanceTask for the new vehicle.
 */
export interface MaintenanceDefault {
  typeId: string;
  name: string;
  category: string;
  milesInterval: number;
  monthsInterval: number;
  description: string;
  vehicleTypes?: VehicleType[];
}

/**
 * Maintenance task stored in Firestore 'maintenanceTasks' collection.
 * 
 * INTERVAL LOGIC:
 * - milesInterval: Service should be performed every X miles
 * - monthsInterval: Service should be performed every X months
 * - Whichever threshold is reached first triggers the reminder
 * 
 * NEXT DUE CALCULATION:
 * - nextDueOdometer = lastServiceOdometer + milesInterval
 * - nextDueDate = lastServiceDate + (monthsInterval * 30 days)
 * 
 * If no service has been logged yet:
 * - nextDueOdometer = vehicle.currentOdometer (at creation) + milesInterval
 * - nextDueDate = createdAt + (monthsInterval * 30 days)
 * 
 * // TODO: Future feature - Add notificationScheduled field for push notification tracking
 */
/**
 * Baseline type indicates whether maintenance data is confirmed or estimated.
 * - confirmed: User provided actual last service data
 * - estimated: User doesn't remember, baseline set from today or estimated
 */
export type BaselineType = 'confirmed' | 'estimated';

export interface MaintenanceTask {
  id: string;
  vehicleId: string;
  userId?: string;
  typeId: string;
  name: string;
  category: string;
  description: string;
  milesInterval: number;
  monthsInterval: number;
  lastServiceOdometer: number | null;
  lastServiceDate: number | null;
  nextDueOdometer: number | null;
  nextDueDate: number | null;
  baselineType?: BaselineType;
  createdAt: number;
  updatedAt: number;
  ownerType: OwnerType;
  fleetId?: string;
}

/**
 * Service log entry stored in Firestore 'serviceLogs' collection.
 * Created when user logs a completed maintenance service.
 * 
 * Key design notes:
 * - taskName is denormalized for display (avoids join on task)
 * - odometer records mileage AT TIME OF SERVICE
 * - receiptUri stores local file path or Firebase Storage URL
 */
export interface ServiceLog {
  id: string;
  vehicleId: string;
  userId: string;
  taskId: string;
  taskName: string;
  category?: string;
  date: number;
  odometer: number;
  notes?: string;
  cost?: number;
  receiptUri?: string;
  createdAt: number;
  ownerType: OwnerType;
  fleetId?: string;
}

/**
 * Fleet organization stored in Firestore 'fleets' collection.
 */
export interface Fleet {
  id: string;
  name: string;
  createdAt: number;
  createdBy: string;
  plan: 'fleet_starter' | 'fleet_pro';
  vehicleLimit: number;
}

/**
 * Fleet member linking a user to a fleet.
 */
export interface FleetMember {
  id: string;
  fleetId: string;
  userId: string;
  role: FleetRole;
  createdAt: number;
  displayName?: string;
  email?: string;
}

/**
 * Fleet invite for pending member additions.
 */
export interface FleetInvite {
  id: string;
  fleetId: string;
  fleetName: string;
  email: string;
  role: FleetRole;
  invitedAt: number;
  invitedBy: string;
  acceptedAt?: number;
}

/**
 * Daily maintenance tip shown on Dashboard.
 * Loaded from Tips.json (35 tips, one per day cycling annually).
 */
export interface Tip {
  id: number;
  title: string;
  tip: string;
}

/**
 * Maintenance status indicating urgency level.
 * Computed in DataContext based on current odometer and date.
 * 
 * - overdue: Past due by miles or time
 * - dueSoon: Within warning threshold (500 mi or 14 days)
 * - upcoming: Not yet approaching due date
 */
export type MaintenanceStatus = 'overdue' | 'dueSoon' | 'upcoming';

/**
 * Extended MaintenanceTask with computed display properties.
 * Created in DataContext for UI consumption.
 * 
 * This is a VIEW MODEL that combines raw task data with:
 * - Computed status based on current vehicle odometer
 * - Calculated miles/days remaining
 * - Resolved vehicle display name
 */
export interface DashboardTask extends MaintenanceTask {
  status: MaintenanceStatus;
  milesRemaining: number | null;
  daysRemaining: number | null;
  vehicleName: string;
}

/**
 * // TODO: Future feature - Trip tracking types (currently disabled)
 * 
 * export interface Trip {
 *   id: string;
 *   vehicleId: string;
 *   userId: string;
 *   startOdometer: number;
 *   endOdometer: number;
 *   distance: number;
 *   startTime: number;
 *   endTime: number;
 *   purpose?: 'personal' | 'business';
 *   notes?: string;
 *   createdAt: number;
 * }
 */
