import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { exportFleetToGoogleSheets, FleetExportData } from "./lib/googleSheets";

export async function registerRoutes(app: Express): Promise<Server> {
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
