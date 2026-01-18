# DriveIQ - Vehicle Maintenance Tracking App

A cross-platform mobile application built with Expo React Native for vehicle maintenance management. DriveIQ helps users manage multiple vehicles, track maintenance schedules, and log service records with manual odometer updates.

## Features

### Core Features
- Multi-vehicle management (cars, pickups, semi-trucks)
- Smart maintenance scheduling with whichever-comes-first logic
- Service logging with date, odometer, notes, and cost tracking
- Receipt photo upload capability
- Theme support (Light, Dark, Pink modes)

### Authentication
- Email/password authentication
- Apple Sign-In (iOS)
- Password reset via email

### Subscription Plans
- **Free**: 1 vehicle, 1 user
- **Personal Pro**: 5 vehicles, all vehicle types, $4.99/month
- **Family Plan**: 5 vehicles, 5 users, $7.99/month
- **Fleet Starter**: 20 vehicles, unlimited users, $14.99/month
- **Fleet Pro**: Unlimited vehicles and users, $29.99+/month

### Multi-User Support
- Family Plan: Invite up to 4 additional members
- Fleet Plans: Role-based access (Admin/Driver)
- Vehicle assignment per member
- Permission levels (view only, full access)

### Additional Features
- Per-vehicle odometer unit selection (miles/kilometers)
- Odometer validation with typo warnings
- Gentle odometer update reminders
- Cost summary analytics (Pro feature)

## Tech Stack

- **Frontend**: Expo SDK 54, React Native
- **Navigation**: React Navigation 7+
- **State Management**: React Context
- **Backend**: Firebase (Authentication, Firestore)
- **Payments**: RevenueCat (Apple In-App Purchases)

## Getting Started

### Prerequisites
- Node.js 18+
- Expo Go app (for mobile testing)

### Installation

1. Clone the repository
```bash
git clone https://github.com/daylenx/DriveIQ.git
cd DriveIQ
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables (create secrets in Replit or .env file):
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_REVENUECAT_API_KEY`

4. Run the development server
```bash
npm run all:dev
```

5. Scan the QR code with Expo Go to test on your device

## Project Structure

```
client/
  ├── components/     # Reusable UI components
  ├── constants/      # Theme, colors, spacing, plans
  ├── context/        # React Context providers
  ├── data/           # Static JSON data
  ├── hooks/          # Custom React hooks
  ├── lib/            # Utilities and helpers
  ├── navigation/     # Navigation structure
  ├── screens/        # Screen components
  └── types/          # TypeScript type definitions
server/
  ├── index.ts        # Express server entry
  └── templates/      # Static landing page
```

## License

This project is private and proprietary.
