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

  const httpServer = createServer(app);

  return httpServer;
}
