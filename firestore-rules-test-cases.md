# Firestore Security Rules Test Cases

After deploying the updated rules to Firebase Console, test these scenarios.

## Test Setup
- **User A**: Personal user (uid: `userA`)
- **User B**: Personal user (uid: `userB`) 
- **User C**: Fleet admin (uid: `userC`, role: `admin` in fleet `fleet1`)
- **User D**: Fleet driver (uid: `userD`, role: `driver` in fleet `fleet1`)
- **User E**: Random authenticated user (uid: `userE`, not in any fleet)

---

## 1. Users Collection

| # | Scenario | Expected | Rule |
|---|----------|----------|------|
| 1.1 | User A reads their own `/users/userA` | ALLOW | Owner can read own doc |
| 1.2 | User B tries to read `/users/userA` | DENY | Cannot read other users |
| 1.3 | User C (fleet admin) reads `/users/userD` (fleet driver) | ALLOW | Admin can read fleet member docs |
| 1.4 | User E reads `/users/userA` | DENY | Random user cannot read |
| 1.5 | User A updates own subscriptionPlan field | DENY | Subscription fields protected |
| 1.6 | User C (admin) tries to write `/users/userD` | DENY | Admins cannot write user docs |

---

## 2. Vehicles Collection

| # | Scenario | Expected | Rule |
|---|----------|----------|------|
| 2.1 | User A reads own vehicle | ALLOW | Owner can read |
| 2.2 | User B reads User A's vehicle | DENY | Cannot cross-read personal vehicles |
| 2.3 | User D (driver) reads fleet vehicle | ALLOW | Fleet members can read |
| 2.4 | User E reads fleet vehicle | DENY | Non-members cannot read fleet vehicles |
| 2.5 | User C (admin) updates fleet vehicle | ALLOW | Admins can update |
| 2.6 | User D (driver) updates `currentOdometer` on fleet vehicle | ALLOW | Drivers can update odometer only |
| 2.7 | User D (driver) updates `nickname` on fleet vehicle | DENY | Drivers cannot update non-odometer fields |
| 2.8 | User A tries to change `userId` on own vehicle | DENY | Ownership fields immutable |

---

## 3. Service Logs Collection

| # | Scenario | Expected | Rule |
|---|----------|----------|------|
| 3.1 | User A reads own service log | ALLOW | Owner can read |
| 3.2 | User B reads User A's log | DENY | Cannot cross-read personal logs |
| 3.3 | User D (driver) creates log for fleet vehicle (with fleetId set) | ALLOW | Drivers can create fleet logs |
| 3.4 | User E creates log with User A's userId | DENY | Cannot impersonate |
| 3.5 | User D (driver) tries to delete fleet log | DENY | Only admins can delete |
| 3.6 | User C (admin) deletes fleet log | ALLOW | Admins can delete |

---

## 4. Fleets & Members

| # | Scenario | Expected | Rule |
|---|----------|----------|------|
| 4.1 | User D (driver) reads `/fleets/fleet1` | ALLOW | Members can read fleet |
| 4.2 | User E reads `/fleets/fleet1` | DENY | Non-members cannot read |
| 4.3 | User C (admin) adds new member | ALLOW | Admins can add members |
| 4.4 | User D (driver) tries to add a member | DENY | Drivers cannot add members |
| 4.5 | User D (driver) tries to change own role to admin | DENY | Cannot self-promote |
| 4.6 | User C (admin) promotes D to admin | DENY | Only fleet creator can create admins |
| 4.7 | User D leaves fleet (deletes own member doc) | ALLOW | Members can leave |

---

## 5. Fleet Invites

| # | Scenario | Expected | Rule |
|---|----------|----------|------|
| 5.1 | User C (admin) creates invite | ALLOW | Admins can invite |
| 5.2 | User D (driver) tries to create invite | DENY | Drivers cannot invite |
| 5.3 | Invitee reads their invite | ALLOW | Invitee can see invite |
| 5.4 | User E reads random invite | DENY | Cannot read others' invites |
| 5.5 | Invitee accepts invite (status: pending -> accepted) | ALLOW | Invitee can accept |
| 5.6 | User C cancels invite | ALLOW | Inviter can cancel |
| 5.7 | User E tries to accept an invite for someone else | DENY | Cannot accept others' invites |

---

## 6. Family Memberships & Invites

| # | Scenario | Expected | Rule |
|---|----------|----------|------|
| 6.1 | Primary user reads family membership | ALLOW | Primary can read |
| 6.2 | Family member reads their own membership | ALLOW | Members can read own |
| 6.3 | Random user reads family membership | DENY | Cannot read others' family |
| 6.4 | Family member leaves (deletes own membership) | ALLOW | Members can leave |
| 6.5 | Invitee accepts family invite | ALLOW | Invitee can accept |

---

## How to Test in Firebase Console

1. Go to **Firebase Console > Firestore > Rules Playground**
2. Select **Simulate** 
3. Choose the operation (get, create, update, delete)
4. Enter the document path (e.g., `/users/userA`)
5. Set the authenticated user UID
6. For reads, the simulator uses existing data
7. For writes, provide the request data as JSON
8. Click **Run** and verify the result matches expected

---

## Deployment Reminder

These rules are saved locally in `firestore.rules`. To deploy:

1. Go to **Firebase Console > Firestore Database > Rules**
2. Copy the contents of `firestore.rules` 
3. Paste and click **Publish**

Or use Firebase CLI:
```bash
firebase deploy --only firestore:rules
```
