/**
 * routes.ts - Express API Routes
 * 
 * PURPOSE:
 * Defines server-side API endpoints that handle operations requiring:
 * - Server-side secrets (API keys that shouldn't be in client code)
 * - External service integrations (Google Places, Google Sheets)
 * 
 * ASSUMPTIONS:
 * - All routes are called from the React Native client
 * - Authentication/authorization is handled at the client level via Firebase
 * - These routes are for development purposes; production data is in Firebase
 * 
 * GUARDRAILS:
 * - All routes validate required parameters before processing
 * - Errors are logged and returned with user-friendly messages
 * - No database mutations happen here (Firebase is used for persistence)
 * 
 * EXTERNAL INTEGRATIONS:
 * - Google Places API (via placesApi.ts): For SOS nearby search
 * - Google Sheets API (via googleSheets.ts): For fleet data export
 * 
 * NON-OBVIOUS RULES:
 * - The server primarily serves static files; these routes are supplementary
 * - No authentication middleware here - client handles auth via Firebase
 * - Both POST and GET endpoints used based on data size (GET for simple queries, POST for large payloads)
 */

import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { exportFleetToGoogleSheets, FleetExportData } from "./lib/googleSheets";
import { searchNearbyPlaces } from "./lib/placesApi";
import { 
  createMaintenanceReminder, 
  syncMaintenanceReminders, 
  listDriveIQEvents,
  deleteMaintenanceReminder,
  MaintenanceReminderEvent 
} from "./lib/googleCalendar";

export async function registerRoutes(app: Express): Promise<Server> {
  /**
   * GET /api/places/nearby
   * 
   * PURPOSE: Search for nearby tow trucks or mechanics for the SOS feature.
   * 
   * PARAMS:
   * - lat: User's latitude (required)
   * - lng: User's longitude (required)
   * - query: Search query like "tow truck" or "auto mechanic" (required)
   * 
   * RETURNS: { places: NearbyPlace[] }
   * 
   * WHY SERVER-SIDE: Keeps GOOGLE_API_KEY secure on the server.
   * The client never sees the API key, preventing abuse.
   */
  app.get("/api/places/nearby", async (req, res) => {
    try {
      const { lat, lng, query } = req.query;
      
      // Validate all required parameters
      if (!lat || !lng || !query) {
        return res.status(400).json({ error: "lat, lng, and query are required" });
      }

      const places = await searchNearbyPlaces(
        parseFloat(lat as string),
        parseFloat(lng as string),
        query as string
      );
      
      res.json({ places });
    } catch (error: any) {
      console.error("Error searching places:", error);
      res.status(500).json({ 
        error: error.message || "Failed to search nearby places" 
      });
    }
  });

  /**
   * POST /api/fleet/export-to-sheets
   * 
   * PURPOSE: Export fleet data to a new Google Spreadsheet.
   * Only accessible to fleet admins (enforced by client).
   * 
   * BODY: FleetExportData object containing:
   * - fleetName: Name for the spreadsheet title
   * - vehicles: Array of vehicle data
   * - serviceLogs: Array of maintenance logs
   * - members: Array of team members
   * - costSummary: Cost analytics data
   * 
   * RETURNS: { success: true, url: "https://docs.google.com/spreadsheets/d/..." }
   * 
   * WHY SERVER-SIDE: 
   * 1. Uses Replit's Google Sheets connector for secure OAuth
   * 2. Keeps OAuth tokens secure on server
   * 3. Handles large data payloads that would be inefficient as GET params
   * 
   * PREREQUISITE: User must have Google Sheets connector set up in Replit
   */
  app.post("/api/fleet/export-to-sheets", async (req, res) => {
    try {
      const data: FleetExportData = req.body;
      
      // Basic validation - full data validation happens in the export function
      if (!data.fleetName) {
        return res.status(400).json({ error: "Fleet name is required" });
      }

      const spreadsheetUrl = await exportFleetToGoogleSheets(data);
      res.json({ success: true, url: spreadsheetUrl });
    } catch (error: any) {
      console.error("Error exporting to Google Sheets:", error);
      res.status(500).json({ 
        error: error.message || "Failed to export to Google Sheets" 
      });
    }
  });

  /**
   * POST /api/calendar/sync-reminders
   * 
   * PURPOSE: Sync maintenance reminders to Google Calendar.
   * Creates calendar events for upcoming maintenance tasks.
   * 
   * BODY: { reminders: MaintenanceReminderEvent[] }
   * 
   * RETURNS: { success: true, created: number, errors: string[] }
   * 
   * PREREQUISITE: User must have Google Calendar connector set up in Replit
   */
  app.post("/api/calendar/sync-reminders", async (req, res) => {
    try {
      const { reminders } = req.body;
      
      if (!reminders || !Array.isArray(reminders)) {
        return res.status(400).json({ error: "reminders array is required" });
      }

      // Convert date strings to Date objects
      const parsedReminders: MaintenanceReminderEvent[] = reminders.map((r: any) => ({
        ...r,
        dueDate: new Date(r.dueDate),
      }));

      const result = await syncMaintenanceReminders(parsedReminders);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Error syncing to Google Calendar:", error);
      res.status(500).json({ 
        error: error.message || "Failed to sync to Google Calendar" 
      });
    }
  });

  /**
   * POST /api/calendar/create-reminder
   * 
   * PURPOSE: Create a single maintenance reminder in Google Calendar.
   * 
   * BODY: MaintenanceReminderEvent object
   * 
   * RETURNS: { success: true, eventId: string }
   */
  app.post("/api/calendar/create-reminder", async (req, res) => {
    try {
      const reminder = req.body;
      
      if (!reminder.vehicleName || !reminder.serviceType || !reminder.dueDate) {
        return res.status(400).json({ error: "vehicleName, serviceType, and dueDate are required" });
      }

      const eventId = await createMaintenanceReminder({
        ...reminder,
        dueDate: new Date(reminder.dueDate),
      });
      
      res.json({ success: true, eventId });
    } catch (error: any) {
      console.error("Error creating calendar reminder:", error);
      res.status(500).json({ 
        error: error.message || "Failed to create calendar reminder" 
      });
    }
  });

  /**
   * GET /api/calendar/events
   * 
   * PURPOSE: List all DriveIQ-created calendar events.
   * Useful for showing synced reminders or avoiding duplicates.
   * 
   * RETURNS: { events: Array<{ id, summary, date }> }
   */
  app.get("/api/calendar/events", async (_req, res) => {
    try {
      const events = await listDriveIQEvents();
      res.json({ events });
    } catch (error: any) {
      console.error("Error listing calendar events:", error);
      res.status(500).json({ 
        error: error.message || "Failed to list calendar events" 
      });
    }
  });

  /**
   * DELETE /api/calendar/events/:eventId
   * 
   * PURPOSE: Delete a DriveIQ calendar event.
   * 
   * PARAMS: eventId - The Google Calendar event ID
   * 
   * RETURNS: { success: true }
   */
  app.delete("/api/calendar/events/:eventId", async (req, res) => {
    try {
      const { eventId } = req.params;
      
      if (!eventId) {
        return res.status(400).json({ error: "eventId is required" });
      }

      await deleteMaintenanceReminder(eventId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting calendar event:", error);
      res.status(500).json({ 
        error: error.message || "Failed to delete calendar event" 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
