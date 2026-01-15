// Load environment variables from .env file
require('dotenv').config();

// Import the libraries we installed
const express = require('express');
const { google } = require('googleapis');
const path = require('path');

// Create the server
const app = express();
const PORT = process.env.PORT || 3000;

// Tell Express to parse JSON data and serve files from "public" folder
app.use(express.json());
app.use(express.static('public'));

// Set up Google Sheets connection
let auth;
if (process.env.GOOGLE_CREDENTIALS_JSON) {
  // For production (Render) - credentials from environment variable
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
} else {
  // For local development - credentials from file
  auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = 'Sheet1';

// Helper function to get all items from the sheet
async function getItems() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:I`,
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) return []; // Only headers or empty

  // Convert rows to objects (skip header row)
  const headers = rows[0];
  const items = rows.slice(1).map((row, index) => ({
    id: index + 2, // Row number in sheet (1-indexed, +1 for header)
    project: row[0] || '',
    description: row[1] || '',
    dueDate: row[2] || '',
    progress: row[3] || 'Not Started',
    priority: row[4] || 'Medium',
    requester: row[5] || '',
    assignee: row[6] || '',
    category: row[7] || '',
    dateSubmitted: row[8] || '',
  }));

  return items;
}

// API: Get all items
app.get('/api/items', async (req, res) => {
  try {
    const items = await getItems();
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// API: Add a new item
app.post('/api/items', async (req, res) => {
  try {
    const { project, description, dueDate, priority, requester, assignee, category } = req.body;
    const dateSubmitted = new Date().toLocaleDateString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:I`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[project, description, dueDate, 'Not Started', priority, requester, assignee, category, dateSubmitted]],
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// API: Update an item's progress (for drag and drop)
app.put('/api/items/:id/progress', async (req, res) => {
  try {
    const rowNumber = parseInt(req.params.id);
    const { progress } = req.body;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!D${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[progress]],
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
