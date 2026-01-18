// Google Sheets integration for fleet data export
import { google } from 'googleapis';

let connectionSettings: any;

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
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

async function getUncachableGoogleSheetClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

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

export async function exportFleetToGoogleSheets(data: FleetExportData): Promise<string> {
  const sheets = await getUncachableGoogleSheetClient();
  
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

  const vehicleHeaders = ['Name', 'Year', 'Make', 'Model', 'VIN', 'Type', 'Odometer', 'Unit', 'Status', 'Assigned Driver', 'Last Updated'];
  const vehicleRows = data.vehicles.map(v => [
    v.name, v.year, v.make, v.model, v.vin, v.type, v.odometer, v.odometerUnit,
    v.isActive ? 'Active' : 'Inactive', v.assignedDriver || '', v.lastUpdated
  ]);

  const logHeaders = ['Vehicle', 'Service Type', 'Date', 'Odometer', 'Unit', 'Cost', 'Vendor', 'Category', 'Notes'];
  const logRows = data.serviceLogs.map(l => [
    l.vehicleName, l.serviceType, l.date, l.odometer, l.odometerUnit,
    l.cost, l.vendor || '', l.category || '', l.notes || ''
  ]);

  const memberHeaders = ['Name', 'Email', 'Role', 'Joined', 'Assigned Vehicles'];
  const memberRows = data.members.map(m => [
    m.name, m.email, m.role, m.joinedAt, m.assignedVehicles
  ]);

  const costRows = [
    ['Cost Summary'],
    [''],
    ['Monthly Total', `$${data.costSummary.monthlyTotal.toFixed(2)}`],
    ['YTD Total', `$${data.costSummary.ytdTotal.toFixed(2)}`],
    [''],
    ['Category Breakdown'],
    ...Object.entries(data.costSummary.categoryBreakdown).map(([cat, amount]) => [cat, `$${amount.toFixed(2)}`])
  ];

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

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
            fields: 'userEnteredFormat(textFormat,backgroundColor)'
          }
        },
        {
          repeatCell: {
            range: { sheetId: 1, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
            fields: 'userEnteredFormat(textFormat,backgroundColor)'
          }
        },
        {
          repeatCell: {
            range: { sheetId: 2, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
            fields: 'userEnteredFormat(textFormat,backgroundColor)'
          }
        }
      ]
    }
  });

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}
