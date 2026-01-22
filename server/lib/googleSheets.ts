/**
 * googleSheets.ts - Google Sheets Export for Fleet Data
 * 
 * PURPOSE:
 * Enables fleet admins to export comprehensive fleet data to Google Sheets.
 * This is a Pro feature that helps fleet managers create reports and analyze data
 * in a familiar spreadsheet format.
 * 
 * ASSUMPTIONS:
 * - User has connected their Google account via Replit's Google Sheets connector
 * - User has appropriate Google Drive permissions to create spreadsheets
 * - Fleet data is already prepared by the calling code
 * 
 * GUARDRAILS:
 * - Uses Replit's connector system for secure OAuth token management
 * - Tokens are automatically refreshed when expired
 * - Spreadsheets are created in the user's own Google Drive (not shared)
 * 
 * EXTERNAL INTEGRATIONS:
 * - Replit Connectors API: Manages OAuth tokens and Google account connection
 * - Google Sheets API (v4): Creates spreadsheets and writes data
 * 
 * NON-OBVIOUS RULES:
 * - Token refresh is handled via Replit's connector infrastructure
 * - The X_REPLIT_TOKEN header uses different prefixes for Repl vs Deployment contexts
 * - Spreadsheet is created with 4 pre-defined sheets (Vehicles, Service Logs, Members, Cost Summary)
 * - batchUpdate is used instead of multiple update calls for performance
 */

import { google } from 'googleapis';

// Cached connection settings to avoid refetching on every request
let connectionSettings: any;

/**
 * Retrieves a valid OAuth access token from Replit's connector system.
 * 
 * WHY: Google APIs require OAuth tokens that expire after 1 hour.
 * Replit's connector handles token refresh automatically, so we just
 * need to fetch the current valid token.
 * 
 * FLOW:
 * 1. Check if cached token is still valid
 * 2. If expired or missing, fetch fresh token from Replit connector API
 * 3. Cache the new token for subsequent calls
 * 
 * REPLIT-SPECIFIC: Uses REPL_IDENTITY for Repls, WEB_REPL_RENEWAL for deployments
 */
async function getAccessToken() {
  // Use cached token if still valid
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  
  // Determine auth token based on environment
  // Repl context uses REPL_IDENTITY, Deployment uses WEB_REPL_RENEWAL
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  // Fetch connection settings including OAuth tokens
  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  // Handle both old and new token response formats
  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

/**
 * Creates a Google Sheets client with fresh OAuth credentials.
 * 
 * WHY: OAuth tokens expire, so we always fetch a fresh token before making API calls.
 * The client is intentionally not cached to ensure we always have valid credentials.
 */
async function getUncachableGoogleSheetClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

/**
 * Data structure for fleet export.
 * Captures all key fleet management data for comprehensive reporting.
 */
export interface FleetExportData {
  fleetName: string;
  vehicles: Array<{
    name: string;
    year: number;
    make: string;
    model: string;
    vin: string;
    type: string;
    odometer: number;
    odometerUnit: string;
    isActive: boolean;
    assignedDriver?: string;
    lastUpdated: string;
  }>;
  serviceLogs: Array<{
    vehicleName: string;
    serviceType: string;
    date: string;
    odometer: number;
    odometerUnit: string;
    cost: number;
    vendor?: string;
    notes?: string;
    category?: string;
  }>;
  members: Array<{
    name: string;
    email: string;
    role: string;
    joinedAt: string;
    assignedVehicles: number;
  }>;
  costSummary: {
    monthlyTotal: number;
    ytdTotal: number;
    categoryBreakdown: Record<string, number>;
  };
}

/**
 * MAJOR FUNCTION: exportFleetToGoogleSheets
 * 
 * Creates a new Google Spreadsheet with fleet data organized into 4 sheets:
 * 1. Vehicles - All fleet vehicles with status and assignment info
 * 2. Service Logs - Complete maintenance history with costs
 * 3. Members - Team members, roles, and vehicle assignments
 * 4. Cost Summary - Monthly/YTD totals and category breakdown
 * 
 * @param data - Complete fleet export data
 * @returns URL to the created Google Spreadsheet
 * 
 * FLOW:
 * 1. Create new spreadsheet with 4 pre-defined sheets
 * 2. Prepare data rows for each sheet
 * 3. Batch update all sheets in a single API call (performance optimization)
 * 4. Apply header formatting (bold, gray background)
 * 5. Return shareable URL
 */
export async function exportFleetToGoogleSheets(data: FleetExportData): Promise<string> {
  const sheets = await getUncachableGoogleSheetClient();
  
  // Create new spreadsheet with date-stamped title for easy identification
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: `${data.fleetName} - Fleet Report - ${new Date().toLocaleDateString()}`
      },
      sheets: [
        { properties: { title: 'Vehicles' } },
        { properties: { title: 'Service Logs' } },
        { properties: { title: 'Members' } },
        { properties: { title: 'Cost Summary' } }
      ]
    }
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId!;
  
  // Get actual sheet IDs from the created spreadsheet
  // Google assigns non-sequential IDs, so we can't assume 0, 1, 2
  const createdSheets = spreadsheet.data.sheets || [];
  const vehiclesSheetId = createdSheets[0]?.properties?.sheetId ?? 0;
  const serviceLogsSheetId = createdSheets[1]?.properties?.sheetId ?? 1;
  const membersSheetId = createdSheets[2]?.properties?.sheetId ?? 2;

  // Prepare vehicle data with headers
  const vehicleHeaders = ['Name', 'Year', 'Make', 'Model', 'VIN', 'Type', 'Odometer', 'Unit', 'Status', 'Assigned Driver', 'Last Updated'];
  const vehicleRows = data.vehicles.map(v => [
    v.name, v.year, v.make, v.model, v.vin, v.type, v.odometer, v.odometerUnit,
    v.isActive ? 'Active' : 'Inactive', v.assignedDriver || '', v.lastUpdated
  ]);

  // Prepare service log data
  const logHeaders = ['Vehicle', 'Service Type', 'Date', 'Odometer', 'Unit', 'Cost', 'Vendor', 'Category', 'Notes'];
  const logRows = data.serviceLogs.map(l => [
    l.vehicleName, l.serviceType, l.date, l.odometer, l.odometerUnit,
    l.cost, l.vendor || '', l.category || '', l.notes || ''
  ]);

  // Prepare member data
  const memberHeaders = ['Name', 'Email', 'Role', 'Joined', 'Assigned Vehicles'];
  const memberRows = data.members.map(m => [
    m.name, m.email, m.role, m.joinedAt, m.assignedVehicles
  ]);

  // Prepare cost summary - structured differently for readability
  const costRows = [
    ['Cost Summary'],
    [''],
    ['Monthly Total', `$${data.costSummary.monthlyTotal.toFixed(2)}`],
    ['YTD Total', `$${data.costSummary.ytdTotal.toFixed(2)}`],
    [''],
    ['Category Breakdown'],
    ...Object.entries(data.costSummary.categoryBreakdown).map(([cat, amount]) => [cat, `$${amount.toFixed(2)}`])
  ];

  // Batch update all sheets at once for performance
  // This is more efficient than multiple individual update calls
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        {
          range: 'Vehicles!A1',
          values: [vehicleHeaders, ...vehicleRows]
        },
        {
          range: 'Service Logs!A1',
          values: [logHeaders, ...logRows]
        },
        {
          range: 'Members!A1',
          values: [memberHeaders, ...memberRows]
        },
        {
          range: 'Cost Summary!A1',
          values: costRows
        }
      ]
    }
  });

  // Apply header formatting - bold text with gray background
  // Use actual sheet IDs retrieved from the created spreadsheet
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId: vehiclesSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
            fields: 'userEnteredFormat(textFormat,backgroundColor)'
          }
        },
        {
          repeatCell: {
            range: { sheetId: serviceLogsSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
            fields: 'userEnteredFormat(textFormat,backgroundColor)'
          }
        },
        {
          repeatCell: {
            range: { sheetId: membersSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
            fields: 'userEnteredFormat(textFormat,backgroundColor)'
          }
        }
      ]
    }
  });

  // Return shareable URL
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}
