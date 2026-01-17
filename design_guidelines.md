# DriveIQ Design Guidelines

## Authentication Architecture

**Auth Required**: Yes - Firebase email/password authentication
- Email/password sign up and login screens
- Password reset flow
- Include Apple Sign-In for iOS (App Store requirement)
- Account screen with logout and delete account options
- Privacy policy & terms of service links on auth screens

## Navigation Architecture

**Root Navigation**: Bottom Tab Bar (5 tabs)
- Dashboard (Home icon) - maintenance overview
- Vehicles (Car icon) - vehicle management
- Trips (Map/Route icon) - trip history
- Logs (List/Document icon) - service records
- Settings (Gear icon) - app settings and account

**Modal Screens** (presented over tabs):
- Add/Edit Vehicle
- Log Maintenance
- View Receipt Photo
- Trip Details
- Active Vehicle Selector (post-trip confirmation)

## Screen Specifications

### 1. Dashboard Screen (Home Tab)
- **Purpose**: Shows maintenance status across all user vehicles
- **Layout**:
  - Transparent header with vehicle selector dropdown (right button)
  - Scrollable content with safe area: top = headerHeight + Spacing.xl, bottom = tabBarHeight + Spacing.xl
  - Three sections: "Overdue" (red accent), "Due Soon" (yellow/orange accent), "Next Up" (green/neutral)
  - Each section contains card list of maintenance items
- **Components**:
  - Vehicle selector button (shows active vehicle name)
  - Maintenance task cards showing: task name, due mileage/date, miles remaining, vehicle name (if multiple)
  - Empty state: "No vehicles added. Add your first vehicle to start tracking maintenance."

### 2. Vehicles Screen
- **Purpose**: Manage user's vehicle fleet
- **Layout**:
  - Default header with "Add Vehicle" button (right)
  - Scrollable list with safe area: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl
  - Vehicle cards in vertical list
- **Components**:
  - Vehicle cards showing: year/make/model, nickname (if set), current odometer, image placeholder or vehicle icon
  - Tap card to view vehicle details and maintenance schedule
  - Empty state: "Add your first vehicle" with large add button

### 3. Vehicle Details Screen (Stack)
- **Purpose**: View and edit specific vehicle information and maintenance schedule
- **Layout**:
  - Default header with "Edit" button (right), back button (left)
  - Scrollable content with tabs/sections: Info, Maintenance Schedule, Safety (if VIN present)
  - Safe area: top = Spacing.xl, bottom = insets.bottom + Spacing.xl
- **Components**:
  - Vehicle info section: year, make, model, trim, VIN, current odometer
  - Maintenance schedule list: each item shows interval (e.g., "Every 3,000 mi or 3 months") and next due
  - Tap item to edit interval for this vehicle

### 4. Add/Edit Vehicle Modal
- **Purpose**: Create or modify vehicle details
- **Layout**:
  - Modal presentation with header, cancel (left), save (right)
  - Scrollable form with safe area: top = Spacing.xl, bottom = keyboard-aware
- **Form Fields**:
  - Year (numeric picker)
  - Make (text input)
  - Model (text input)
  - Trim (optional text input)
  - Nickname (optional text input)
  - VIN (optional text input with scan button)
  - Starting/Current Odometer (numeric input, required)
- Submit button in header (disabled until required fields valid)

### 5. Trips Screen
- **Purpose**: View trip history and start/stop tracking
- **Layout**:
  - Default header with filter button (right)
  - List view with pull-to-refresh
  - Safe area: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl
  - Floating action button (FAB) for "Start Trip" when not tracking
- **Components**:
  - Active trip indicator banner (when tracking): shows live miles, duration, "End Trip" button
  - Trip cards showing: date, distance, duration, vehicle assigned (or "Unassigned"), tap for details
  - Empty state: "No trips recorded. Start tracking your first trip."

### 6. Trip Confirmation Modal (post-trip)
- **Purpose**: Confirm or reassign trip to vehicle
- **Layout**:
  - Bottom sheet modal
  - Content: trip summary (distance, duration)
  - Buttons: "Logged to [Vehicle Name]" (primary), "Change Vehicle", "Not My Car" (destructive)

### 7. Logs Screen
- **Purpose**: View all service/maintenance history across vehicles
- **Layout**:
  - Default header with filter button (right), add log button (right)
  - List view grouped by vehicle or date
  - Safe area: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl
- **Components**:
  - Service log cards: maintenance type, date, odometer, cost, vehicle name
  - Receipt indicator icon if photo attached
  - Tap to view full details and receipt

### 8. Log Maintenance Modal
- **Purpose**: Record completed service
- **Layout**:
  - Modal with header, cancel (left), save (right)
  - Scrollable form
- **Form Fields**:
  - Vehicle selector (if multiple vehicles)
  - Maintenance type (picker from library)
  - Date (date picker)
  - Odometer reading (numeric input, required)
  - Cost (currency input, optional)
  - Notes (text area, optional)
  - Receipt photo (camera/gallery picker, optional)

### 9. Settings Screen
- **Purpose**: App preferences and account management
- **Layout**:
  - Default header
  - Scrollable grouped list with safe area: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl
- **Sections**:
  - Profile: display name, email (read-only)
  - Trip Settings: auto-tracking preferences, GPS accuracy threshold
  - Notifications: maintenance reminders, trip tracking alerts
  - Maintenance Library: view/edit default intervals (advanced)
  - Account: Change password, Logout, Delete Account (nested)

### 10. Safety Screen (conditional)
- **Purpose**: Show vehicle recalls if VIN entered
- **Layout**:
  - Part of Vehicle Details tabs
  - Scrollable list
- **Components**:
  - Recall cards: title, description, severity indicator, NHTSA reference
  - Empty state: "No active recalls for this vehicle" (green checkmark)

## Design System

### Color Palette
- **Primary**: Deep blue (#2563EB) - for main actions, active states
- **Accent**: Bright orange (#F97316) - for "due soon" alerts, CTAs
- **Success**: Green (#10B981) - for "next up" items, completed states
- **Warning**: Amber (#F59E0B) - for approaching due items
- **Danger**: Red (#EF4444) - for overdue items, destructive actions
- **Background**: White (#FFFFFF) and Light Gray (#F9FAFB)
- **Text**: Dark Gray (#111827) primary, Medium Gray (#6B7280) secondary
- **Border**: Light Gray (#E5E7EB)

### Typography
- **Headers**: SF Pro Display (iOS) / Roboto (Android), Semi-Bold, 24-28px
- **Subheaders**: SF Pro Text / Roboto, Medium, 18-20px
- **Body**: SF Pro Text / Roboto, Regular, 16px
- **Caption**: SF Pro Text / Roboto, Regular, 14px
- **Button**: SF Pro Text / Roboto, Semi-Bold, 16px

### Component Patterns
- **Cards**: White background, subtle border (1px #E5E7EB), rounded corners (12px), padding 16px
- **Buttons**: Primary (filled primary color), Secondary (outlined), Destructive (red), minimum height 48px
- **FAB**: Circular, primary color, diameter 56px, floating with shadow (offset: {width: 0, height: 2}, opacity: 0.10, radius: 2)
- **Input Fields**: Border 1px solid #E5E7EB, rounded 8px, padding 12px, focus state with primary border
- **Status Indicators**: Small colored dot + text label, or colored badge with icon

### Visual Design
- Use Feather icons from @expo/vector-icons for all UI elements
- Avoid emojis; use icons for visual communication
- Minimal use of shadows except for floating elements
- Trip tracking active state should use animated indicators (pulsing dot)
- Receipt photos should display as thumbnails with tap-to-expand
- Vehicle cards can use placeholder car icon (no custom illustrations needed initially)

### Interaction Design
- All touchable elements have visual feedback (opacity 0.7 on press)
- Swipe-to-delete on log entries and trip cards
- Pull-to-refresh on list screens
- Form validation with inline error messages
- Confirmation alerts for destructive actions (delete vehicle, delete account)
- Loading states with activity indicators for async operations

### Accessibility
- Minimum touch target: 44x44px
- Color contrast ratio: 4.5:1 for text, 3:1 for UI components
- Dynamic type support for text scaling
- VoiceOver/TalkBack labels for all interactive elements
- Error messages announced to screen readers
- Keyboard navigation support for form inputs