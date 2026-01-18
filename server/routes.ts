import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { exportFleetToGoogleSheets, FleetExportData } from "./lib/googleSheets";
import { searchNearbyPlaces } from "./lib/placesApi";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/places/nearby", async (req, res) => {
    try {
      const { lat, lng, query } = req.query;
      
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

  app.post("/api/fleet/export-to-sheets", async (req, res) => {
    try {
      const data: FleetExportData = req.body;
      
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
