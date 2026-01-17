# DriveIQ Architecture

## Overview

DriveIQ is a cross-platform mobile vehicle maintenance tracking application built with Expo (React Native) and Firebase. The app helps users track maintenance schedules, log service history, and receive timely reminders for upcoming maintenance tasks.

**Key Design Decisions:**
- Manual odometer entry only (no GPS/trip tracking)
- Firebase for authentication and real-time data sync
- Whichever-comes-first maintenance reminders (miles OR time)
- Three theme modes: Light, Dark, and Pink

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                           │
│  (DashboardScreen, MaintenanceScreen, VehiclesScreen, etc.)     │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DataContext.tsx                            │
│  - Real-time Firestore listeners (onSnapshot)                   │
│  - Computes DashboardTasks with status from raw MaintenanceTasks│
│  - Provides CRUD operations for vehicles, tasks, logs           │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Firebase Firestore                          │
│  Collections: vehicles, maintenanceTasks, serviceLogs           │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Steps

1. **User authenticates** via AuthContext → Firebase Auth
2. **DataContext subscribes** to Firestore collections filtered by userId
3. **Real-time updates** flow from Firestore → DataContext → UI components
4. **User actions** (add vehicle, log service) → DataContext methods → Firestore writes
5. **Status computation** happens in DataContext's `dashboardTasks` memo

---

## Firestore Structure

### Collections

#### `vehicles`
```typescript
{
  id: string;              // Document ID (UUID)
  userId: string;          // Owner's Firebase UID
  year: number;            // e.g., 2020
  make: string;            // e.g., "Toyota"
  model: string;           // e.g., "Camry"
  trim?: string;           // e.g., "SE"
  nickname: string;        // Display name
  vin?: string;            // Optional VIN
  currentOdometer: number; // Current mileage (manually updated)
  isActive: boolean;       // Currently selected vehicle
  createdAt: number;       // Unix timestamp
  updatedAt: number;       // Unix timestamp
}
```

#### `maintenanceTasks`
```typescript
{
  id: string;               // Document ID (UUID)
  vehicleId: string;        // FK to vehicles
  userId: string;           // Owner's Firebase UID
  typeId: string;           // Unique task type (e.g., "oil_change")
  name: string;             // Display name
  category: string;         // Grouping (e.g., "Engine", "Tires")
  description: string;      // Helpful context
  milesInterval: number;    // Service every X miles
  monthsInterval: number;   // Service every X months
  lastServiceOdometer: number | null;  // Odometer at last service
  lastServiceDate: number | null;      // Unix timestamp of last service
  nextDueOdometer: number;  // Calculated: lastService + milesInterval
  nextDueDate: number;      // Calculated: lastServiceDate + monthsInterval
  createdAt: number;
  updatedAt: number;
}
```

#### `serviceLogs`
```typescript
{
  id: string;              // Document ID (UUID)
  vehicleId: string;       // FK to vehicles
  taskId: string;          // FK to maintenanceTasks
  userId: string;          // Owner's Firebase UID
  taskName: string;        // Denormalized for display
  date: number;            // Service date (Unix timestamp)
  odometer: number;        // Odometer at service
  cost?: number;           // Optional cost
  notes?: string;          // Optional notes
  receiptUri?: string;     // Optional receipt photo URI
  createdAt: number;
}
```

### Required Composite Indexes

Create these in Firebase Console → Firestore → Indexes:

1. **vehicles** - `userId ASC, createdAt DESC`
2. **serviceLogs** - `userId ASC, date DESC`

---

## Maintenance Status Computation

The core business logic for determining task urgency lives in `DataContext.tsx`.

### Algorithm

```typescript
// For each maintenance task:
milesRemaining = task.nextDueOdometer - vehicle.currentOdometer
daysRemaining = (task.nextDueDate - now) / MS_PER_DAY

// Status determination (whichever threshold is hit first)
if (milesRemaining <= 0 || daysRemaining <= 0) {
  status = 'overdue'
} else if (milesRemaining <= 500 || daysRemaining <= 14) {
  status = 'dueSoon'  
} else {
  status = 'upcoming'
}
```

### Thresholds

| Status | Miles Threshold | Time Threshold |
|--------|-----------------|----------------|
| Overdue | ≤ 0 miles remaining | ≤ 0 days remaining |
| Due Soon | ≤ 500 miles remaining | ≤ 14 days remaining |
| Upcoming | > 500 miles | > 14 days |

### When Status Updates

- When user **logs a service**: nextDue values recalculated
- When user **updates odometer**: milesRemaining changes
- When **time passes**: daysRemaining changes (computed on each render)
- When user **modifies interval**: nextDue values recalculated

### Sorting Logic

Tasks are sorted for display by:
1. **Status priority**: overdue → dueSoon → upcoming
2. **Within status**: by miles remaining (closest first)

---

## Future Extensibility

The codebase includes TODO comments marking integration points for future features:

### VIN Decode & Recalls
- Location: Vehicle creation flow
- Integration: Third-party VIN API (NHTSA, Carfax)
- Purpose: Auto-populate vehicle specs, check for recalls

### Automatic Trip Tracking
- Location: Background location service
- Integration: expo-location with background tasks
- Purpose: Automatically update odometer from GPS distance
- Note: Currently disabled - app uses manual entry only

### Push Notifications
- Location: After logging service / on app launch
- Integration: expo-notifications + FCM
- Purpose: Alert users when tasks become due soon

---

## Context Providers

```
App.tsx
└── ErrorBoundary
    └── QueryClientProvider
        └── SafeAreaProvider
            └── GestureHandlerRootView
                └── KeyboardProvider
                    └── ThemeProvider
                        └── AuthProvider
                            └── DataProvider
                                └── NavigationContainer
                                    └── RootStackNavigator
```

### AuthContext
- Manages Firebase Auth state
- Provides: user, isLoading, signIn, signUp, signOut, deleteAccount
- Persists auth state across app restarts

### DataContext  
- Manages all application data
- Sets up Firestore real-time listeners
- Computes derived state (dashboardTasks)
- Provides CRUD operations

### ThemeContext
- Manages theme preference (light/dark/pink)
- Persists to AsyncStorage
- Provides theme colors and isDark flag

---

## File Structure

```
client/
├── components/          # Reusable UI components
├── constants/           # Theme, spacing, colors
├── context/             # React contexts (Auth, Data, Theme)
├── data/                # Static data (MaintenanceDefaults.json, Tips.json)
├── hooks/               # Custom hooks
├── lib/                 # Utilities (firebase.ts, storage.ts, query-client.ts)
├── navigation/          # React Navigation setup
├── screens/             # Screen components
└── types/               # TypeScript type definitions
```
