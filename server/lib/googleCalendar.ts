/**
 * googleCalendar.ts - Google Calendar Integration for Maintenance Reminders
 * 
 * PURPOSE:
 * Enables users to sync their vehicle maintenance reminders with Google Calendar.
 * This helps users get calendar notifications for upcoming services.
 * 
 * ASSUMPTIONS:
 * - User has connected their Google account via Replit's Google Calendar connector
 * - User has appropriate Google Calendar permissions
 * - Maintenance tasks have due dates calculated
 * 
 * GUARDRAILS:
 * - Uses Replit's connector system for secure OAuth token management
 * - Tokens are automatically refreshed when expired
 * - Events are created in the user's primary calendar
 * 
 * EXTERNAL INTEGRATIONS:
 * - Replit Connectors API: Manages OAuth tokens and Google account connection
 * - Google Calendar API (v3): Creates and manages calendar events
 */

import { google } from 'googleapis';

let connectionSettings: any;

/**
 * Retrieves a valid OAuth access token from Replit's connector system.
 */
async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

/**
 * Creates a Google Calendar client with fresh OAuth credentials.
 * WARNING: Never cache this client - access tokens expire.
 */
async function getUncachableGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Data structure for a maintenance reminder event
 */
export interface MaintenanceReminderEvent {
  vehicleName: string;
  serviceType: string;
  dueDate: Date;
  dueMileage?: number;
  odometerUnit?: string;
  notes?: string;
}

/**
 * MAJOR FUNCTION: createMaintenanceReminder
 * 
 * Creates a calendar event for an upcoming maintenance task.
 * The event is an all-day event on the due date with details about the service.
 * 
 * @param reminder - The maintenance reminder details
 * @returns The created event ID
 */
export async function createMaintenanceReminder(reminder: MaintenanceReminderEvent): Promise<string> {
  const calendar = await getUncachableGoogleCalendarClient();
  
  // Format the due date as an all-day event
  const dateStr = reminder.dueDate.toISOString().split('T')[0];
  
  // Build description with all relevant details
  let description = `Vehicle: ${reminder.vehicleName}\nService: ${reminder.serviceType}`;
  if (reminder.dueMileage) {
    description += `\nDue at: ${reminder.dueMileage.toLocaleString()} ${reminder.odometerUnit || 'mi'}`;
  }
  if (reminder.notes) {
    description += `\n\nNotes: ${reminder.notes}`;
  }
  description += '\n\n-- Created by DriveIQ';
  
  const event = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: `[DriveIQ] ${reminder.serviceType} - ${reminder.vehicleName}`,
      description,
      start: {
        date: dateStr,
      },
      end: {
        date: dateStr,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 1440 }, // 1 day before
          { method: 'popup', minutes: 10080 }, // 1 week before
        ],
      },
    },
  });
  
  return event.data.id || '';
}

/**
 * MAJOR FUNCTION: syncMaintenanceReminders
 * 
 * Syncs multiple maintenance reminders to Google Calendar.
 * Creates events for each upcoming maintenance task.
 * 
 * @param reminders - Array of maintenance reminders to sync
 * @returns Object with count of created events and any errors
 */
export async function syncMaintenanceReminders(reminders: MaintenanceReminderEvent[]): Promise<{
  created: number;
  errors: string[];
}> {
  const results = {
    created: 0,
    errors: [] as string[],
  };
  
  for (const reminder of reminders) {
    try {
      await createMaintenanceReminder(reminder);
      results.created++;
    } catch (error: any) {
      results.errors.push(`Failed to create reminder for ${reminder.vehicleName} - ${reminder.serviceType}: ${error.message}`);
    }
  }
  
  return results;
}

/**
 * Lists all DriveIQ-created events from the user's calendar.
 * Useful for avoiding duplicates or syncing status.
 */
export async function listDriveIQEvents(): Promise<Array<{
  id: string;
  summary: string;
  date: string;
}>> {
  const calendar = await getUncachableGoogleCalendarClient();
  
  // Get events with DriveIQ prefix from the past month to future
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixMonthsFromNow = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
  
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: oneMonthAgo.toISOString(),
    timeMax: sixMonthsFromNow.toISOString(),
    q: '[DriveIQ]',
    singleEvents: true,
    orderBy: 'startTime',
  });
  
  return (response.data.items || []).map(event => ({
    id: event.id || '',
    summary: event.summary || '',
    date: event.start?.date || event.start?.dateTime || '',
  }));
}

/**
 * Deletes a DriveIQ event from the calendar.
 */
export async function deleteMaintenanceReminder(eventId: string): Promise<void> {
  const calendar = await getUncachableGoogleCalendarClient();
  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });
}
