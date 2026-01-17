# DriveIQ - Vehicle Maintenance Tracking App

## Overview
DriveIQ is a cross-platform mobile application built with Expo React Native for vehicle maintenance management. The app helps users manage multiple vehicles, track maintenance schedules, and log service records with manual odometer updates.

## Current State
- MVP complete with all core features functional
- Theme system implemented with Light, Dark, and Pink modes
- Firebase authentication and Firestore database
- Subscription plan system with soft gating (dev mode)
- 4-tab bottom navigation (Dashboard, Vehicles, Logs, Settings)

## Recent Changes
- January 2025: RevenueCat subscription integration
  - Added RevenueCatContext for subscription management via Apple In-App Purchases
  - RevenueCat initializes on app startup and identifies users with Firebase uid
  - Offerings are fetched from RevenueCat and mapped to existing plans
  - Purchases and restores sync entitlements with Firebase user data
  - Entitlements: personal_pro, family, fleet_starter, fleet_pro
  - Set EXPO_PUBLIC_REVENUECAT_API_KEY secret for production
  - PAYWALLS_ENABLED=true activates real payments on iOS
- January 2025: Fleet creation improvements
  - Added fleet name input modal during fleet plan selection
  - Added "Create Your Fleet" button in Settings for users on fleet plans without a fleet
  - Fleet membership status indicator shows fleet name and role (Admin/Driver/Member) in Settings
  - Data migration: When fleet is created, owner's existing vehicles/tasks/logs are automatically migrated
  - New vehicles and service logs created by fleet members automatically get fleetId
  - refreshUserProfile called after fleet operations to update user context
- December 2024: Fleet data loading for fleet members
  - DataContext now loads both personal AND fleet vehicles/tasks/logs
  - Fleet members see all vehicles with their fleetId
  - Firestore rules updated to allow reading data where fleetId is present
  - IMPORTANT: Deploy firestore.rules to Firebase Console after changes
- December 2024: Gentle odometer reminder system implemented
  - OdometerReminderBanner component shows after 14 days without update
  - Snooze options: 7, 14, or 30 days (stored in AsyncStorage)
  - Minimum 7 days between reminder displays
  - User setting to disable reminders in Settings > Notifications
  - lastOdometerUpdate field added to Vehicle type, updated by DataContext.updateOdometer
- December 2024: Cost Summary analytics for Pro users
  - CostSummaryCard shows total spent, category breakdown, and recent costs
  - Gated behind Pro plan with locked preview for free users
  - ServiceLog now includes category field (populated from MaintenanceTask)
- December 2024: Multi-user wording polished
  - "Family Members" replaced with "Members" throughout UI
  - Updated FamilyManagementScreen, SettingsScreen, RootStackNavigator, plans.ts
- December 2024: Odometer unit support added (miles/kilometers per vehicle)
- Added OdometerUnit type ('mi' | 'km') with per-vehicle unit selection in AddVehicleModal
- Created VehicleSettingsModal for changing units with automatic conversion of all related data
- Added odometer validation warnings for decreases and large jumps (>5000 units)
- Created FleetContext foundation for fleet organization management
- Updated Vehicle, MaintenanceTask, ServiceLog types with ownerType and fleetId for fleet support
- Unit conversion utilities in client/lib/units.ts
- All screens updated to display correct unit labels (mi/km)
- December 2024: Multi-user Family Plan system implemented
- Added Family Plan ($7.99/mo, 5 vehicles, 5 users, Car/Pickup only)
- Updated pricing: Personal Pro $4.99/mo, Fleet Starter $14.99/mo, Fleet Pro $29.99+/mo
- Created FamilyContext for managing family memberships, invites, and permissions
- Added FamilyManagementScreen for inviting/removing members
- Implemented permission system (view_only, full_access) with usePermissions hook
- Vehicle-type-specific maintenance schedules (20 tasks for cars, 25 for pickups, 29 for semi-trucks)
- Updated vehicle type icons (car-side, truck, truck-trailer) in AddVehicleModal
- Feature flags: PAYWALLS_ENABLED=false (no real payments), DEV_PREVIEW_PAYWALL=true (testing)

## Architecture

### Frontend (client/)
- **Framework**: Expo SDK 54 with React Native
- **Navigation**: React Navigation 7+ with bottom tabs and stack navigators
- **State Management**: React Context (AuthContext, DataContext, ThemeContext, FamilyContext, FleetContext)
- **Data Fetching**: TanStack React Query
- **Styling**: StyleSheet.create with theme constants
- **Storage**: Firebase Firestore + AsyncStorage for local preferences

### Backend (server/)
- **Framework**: Express.js with TypeScript
- **Purpose**: Static file serving and API endpoints (minimal backend, most logic is client-side)

### Key Files
- `client/App.tsx` - Main app entry with providers
- `client/context/AuthContext.tsx` - Firebase auth and user profile management
- `client/context/DataContext.tsx` - Vehicles, maintenance, service logs + canAddVehicle gating
- `client/context/ThemeContext.tsx` - Theme state management
- `client/constants/featureFlags.ts` - PAYWALLS_ENABLED, DEV_PREVIEW_PAYWALL flags
- `client/constants/plans.ts` - Plan definitions (Free, Personal Pro, Fleet tiers)
- `client/components/UpgradeModal.tsx` - Plan limit modal with upgrade options
- `client/screens/PricingScreen.tsx` - Plan selection and simulated upgrades
- `client/screens/UsageIntentScreen.tsx` - Post-signup onboarding flow
- `client/context/FamilyContext.tsx` - Family membership and invitation management
- `client/screens/FamilyManagementScreen.tsx` - UI for managing family members
- `client/hooks/usePermissions.ts` - Centralized permission checking
- `client/components/InvitePromptModal.tsx` - Modal for accepting family invitations
- `client/context/FleetContext.tsx` - Fleet organization and member management
- `client/screens/VehicleSettingsModal.tsx` - Vehicle settings with unit conversion
- `client/lib/units.ts` - Odometer unit conversion utilities
- `client/components/OdometerReminderBanner.tsx` - Gentle odometer update reminder
- `client/components/CostSummaryCard.tsx` - Cost analytics for Pro users
- `client/context/RevenueCatContext.tsx` - RevenueCat subscription management
- `client/components/RevenueCatWrapper.tsx` - RevenueCat integration wrapper

## Project Structure
```
client/
  ├── components/     # Reusable UI components
  ├── constants/      # Theme, colors, spacing, plans, feature flags
  ├── context/        # React Context providers
  ├── data/           # Static JSON data (maintenance library, tips)
  ├── hooks/          # Custom React hooks
  ├── lib/            # Utilities and helpers
  ├── navigation/     # Navigation structure
  ├── screens/        # Screen components
  └── types/          # TypeScript type definitions
server/
  ├── index.ts        # Express server entry
  └── templates/      # Static landing page
```

## User Preferences
- Color scheme: Blue primary (#2563EB), Orange accent (#F97316), Pink theme option (#EC4899)
- Clean, minimal mobile-optimized UI
- No emojis in the app
- Proper touch targets and safe areas

## Features

### Completed (MVP)
- Email/password authentication with Firebase
- Multi-vehicle management (year, make, model, trim, VIN, odometer)
- Preloaded maintenance library from local JSON
- Smart dashboard with Due Soon, Overdue, Upcoming status
- Service log creation with date, odometer, notes, cost
- Receipt photo upload capability
- Theme system (Light, Dark, Pink)
- Subscription plan system with soft gating

### Plan System
- **Free Plan**: 1 vehicle, 1 user, Cars and Pickups only (no Semi-Trucks)
- **Personal Pro**: 5 vehicles, 1 user, all types including semi-trucks, $4.99/month
- **Family Plan**: 5 vehicles, 5 users, Cars and Pickups only, $7.99/month
- **Fleet Starter**: 20 vehicles, unlimited users, all types, $14.99/month
- **Fleet Pro**: Unlimited vehicles, unlimited users, all types, $29.99+/month
- Feature flags control enforcement:
  - PAYWALLS_ENABLED=false + DEV_PREVIEW_PAYWALL=true: Show gating with bypass
  - PAYWALLS_ENABLED=false + DEV_PREVIEW_PAYWALL=false: No enforcement
  - PAYWALLS_ENABLED=true: Full enforcement (production)

### Multi-User System (Family/Fleet Plans)
- Primary users can invite up to (userLimit - 1) additional members via email
- Permission levels: view_only (read access), full_access (can edit/log services)
- Vehicle assignment: Primary assigns specific vehicles to each member
- Access controls: Only primary user can change plan, remove vehicles, manage users
- Firestore collections: familyMemberships (links users), familyInvites (pending invites)

### Vehicle Types
- **car**: Passenger cars, sedans, SUVs, minivans
- **pickup**: Pickup trucks, light trucks
- **semi**: Semi-trucks, commercial trucks (requires Personal Pro or higher)

### Odometer Units
- Each vehicle has its own unit setting ('mi' or 'km')
- New vehicles default to 'mi' (miles)
- Vehicle Settings screen allows changing unit with automatic conversion
- Conversion updates: vehicle odometer, maintenance task due values, service log readings
- Validation warnings for typos: decrease detection, large jump detection (>5000 units)

### Baseline Type Tracking
- New maintenance tasks default to `baselineType: 'estimated'`
- Logging a service sets `baselineType: 'confirmed'`
- Estimated baselines never show "overdue" status (cap at "dueSoon")
- Dashboard shows "Est" badge for estimated items

### Odometer Reminders
- Gentle reminder banner in VehicleDetailScreen after 14 days without odometer update
- Snooze options: 7, 14, or 30 days (stored in AsyncStorage per vehicle)
- Minimum 7 days between reminder displays even without snooze
- User can disable reminders in Settings > Notifications
- disableOdometerReminders field on User type

### Cost Summary Analytics (Pro Feature)
- CostSummaryCard in VehicleDetailScreen shows spending breakdown
- Total spent, top categories, and recent costs
- Free users see locked preview with upgrade prompt
- ServiceLog.category field populated from MaintenanceTask when logging

### RevenueCat Subscriptions
- RevenueCatContext manages all subscription operations
- Initialization: Configured on app startup with EXPO_PUBLIC_REVENUECAT_API_KEY
- User identification: Uses Firebase uid for RevenueCat user identity
- Offerings: Fetched from RevenueCat and mapped to plan selection UI
- Entitlement mapping:
  - personal_pro → Personal Pro plan
  - family → Family plan
  - fleet_starter → Fleet Starter plan
  - fleet_pro → Fleet Pro plan
  - No entitlement → Free plan
- Purchase flow: Package selection → RevenueCat purchase → Sync to Firebase
- Restore purchases: Available on iOS, syncs entitlements back to Firebase
- On login: Checks active entitlements and syncs if Firebase plan differs
- Feature flags:
  - PAYWALLS_ENABLED=true → Real payments via RevenueCat on iOS
  - PAYWALLS_ENABLED=false + DEV_PREVIEW_PAYWALL=true → Preview mode (no real payments)

### Fleet System (Implemented)
- FleetContext provides state management for fleet organizations
- Fleet roles: admin (full access), driver (limited to assigned vehicles)
- Fleet invite/accept/decline workflow with FleetInvitePromptModal
- FamilyManagementScreen now detects fleet mode and uses FleetContext for invites
- Fleet owner's Members screen shows Driver/Admin role selector instead of Full Access/View Only
- Invitations display the fleet name so users know which fleet they're joining
- InvitePromptModal skips when a FleetInvite exists, so FleetInvitePromptModal handles fleet invites
- Fleet-owned vehicles use ownerType: 'fleet' with fleetId reference
- DataContext loads both personal AND fleet vehicles when user has fleetId
- Fleet membership status displayed in Settings with role badge
- Error alerts shown when invite accept/decline fails (previously failed silently)
- **IMPORTANT: Deploy firestore.rules to Firebase Console for fleet features to work**
  1. Go to Firebase Console > Firestore Database > Rules
  2. Copy contents of firestore.rules file and publish
  3. Without this, fleet members cannot accept invitations or see fleet vehicles

### Planned (Next Phase)
- Fleet Dashboard screen with summary statistics
- Fleet onboarding flow for new fleet accounts
- VIN decoding and NHTSA recall lookup with Safety tab
- Push notifications for maintenance reminders
- Maintenance history charts and cost analytics
- Data export for service logs
- Vehicle photo gallery and document storage

## Development

### Running the App
```bash
npm run all:dev
```
- Expo runs on port 8081 (web)
- Express server runs on port 5000

### Testing on Device
- Scan QR code with Expo Go app
- Web version available at localhost:8081

### Dev Tools
- Settings > DEV TOOLS section (visible when DEV_PREVIEW_PAYWALL=true)
- "Reset to Free Plan" button resets user to free tier for testing

## Design Notes
- Manual odometer updates only - NO GPS/location/motion/trip tracking
- Whichever-comes-first maintenance reminders using OR logic (overdue if miles <= 0 OR days <= 0)
- Service intervals are system-defined and NOT user-editable
- Theme properties: use 'danger' instead of 'error', use 'h4'/'small' instead of 'subtitle'/'caption'
- Firestore: Optional fields must be conditionally added to avoid undefined values

## Notes
- Theme selection persists across app restarts
- ErrorBoundary uses system color scheme fallback (not ThemeContext) to avoid context errors
- Minor Expo package version warnings are informational and don't affect functionality
