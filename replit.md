# DriveIQ - Vehicle Maintenance Tracking App

## Overview
DriveIQ is a cross-platform mobile application built with Expo React Native for comprehensive vehicle maintenance management. It allows users to manage multiple vehicles, track maintenance schedules, log service records with manual odometer updates, and offers multi-user capabilities for families and fleets. The project aims to provide a streamlined, user-friendly experience for vehicle owners and fleet managers to ensure timely maintenance and optimize vehicle longevity and cost management.

## User Preferences
- Color scheme: Blue primary (#2563EB), Orange accent (#F97316), Pink theme option (#EC4899)
- Clean, minimal mobile-optimized UI
- No emojis in the app
- Proper touch targets and safe areas
- Manual odometer updates only - NO GPS/location/motion/trip tracking

## System Architecture

### Frontend
- **Framework**: Expo SDK 54 with React Native
- **Navigation**: React Navigation 7+ (bottom tabs, stack navigators)
- **State Management**: React Context (AuthContext, DataContext, ThemeContext, FamilyContext, FleetContext, RevenueCatContext)
- **Data Fetching**: TanStack React Query
- **Styling**: StyleSheet.create with theme constants
- **Storage**: Firebase Firestore + AsyncStorage for local preferences
- **UI/UX Decisions**:
    - **Theme System**: Light, Dark, and Pink modes.
    - **Navigation**: 5-tab bottom navigation (Dashboard, Vehicles, SOS, Logs, Settings).
    - **Odometer Units**: Per-vehicle unit selection ('mi' | 'km') with automatic conversion.
    - **Reminder System**: Gentle odometer reminder banner after 14 days without update.
    - **Cost Analytics**: Cost Summary Card for Pro users, showing spending breakdown.
    - **Multi-user UI**: Adapted screens for family and fleet management, including role-based access.

### Backend
- **Framework**: Express.js with TypeScript
- **Purpose**: Primarily for static file serving; most application logic is client-side.

### Core Features
- **Authentication**: Firebase Email/password, Apple Sign-In.
- **Vehicle Management**: Add/manage vehicles with details (year, make, model, VIN, odometer), specific maintenance schedules per vehicle type (car, pickup, semi-truck).
- **Maintenance Tracking**: Preloaded maintenance library, smart dashboard with status (Due Soon, Overdue, Upcoming), service log creation with cost and receipt photo upload.
- **Subscription Plans**: Tiered plans (Free, Personal Pro, Family, Fleet Starter, Fleet Pro) with soft gating and RevenueCat integration for in-app purchases.
- **Multi-User System**:
    - **Family Plan**: Supports multiple users with permission levels (view_only, full_access) and vehicle assignments.
    - **Fleet System**: Fleet organizations with admin/driver roles, fleet-specific data management, and invitation workflows.
- **Odometer Management**: Per-vehicle odometer units with automatic conversion, validation for decreases and large jumps.
- **Analytics**: Cost summary for Pro users, fleet dashboard with comprehensive analytics (for fleet users).
- **Theme System**: Persisted theme selection with Light, Dark, and Pink options.
- **Maintenance Logic**: "Whichever-comes-first" reminders (miles OR days). Service intervals are system-defined.
- **SOS/Roadside Assistance**: Emergency tab for finding nearby tow trucks or mechanics.
    - Service type selection (Tow/Mechanic) with auto-detected vehicle type
    - Location permission requested only on "Find Nearby" tap (no background tracking)
    - Nearby places search via Google Places API with tap-to-call functionality
    - Share location feature opens share sheet with Apple/Google Maps links

## External Dependencies
- **Firebase**: Authentication, Firestore Database.
- **Expo React Native**: Cross-platform development framework.
- **React Navigation**: For in-app navigation.
- **TanStack React Query**: For data fetching and caching.
- **RevenueCat**: Subscription management and in-app purchase processing (Apple In-App Purchases).
- **AsyncStorage**: For local preference storage.
- **expo-apple-authentication**: For Apple Sign-In on iOS.
- **Google Sheets API**: Fleet admins can export data to Google Sheets (via Replit connector).
- **Google Places API**: SOS feature uses Places API to find nearby tow trucks and mechanics.