const { google } = require("googleapis");

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

let sheetsClient;

function getClient() {
  if (sheetsClient) return sheetsClient;

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

// Reads every data row from a tab (skips row 1, the header) and returns
// each one tagged with its real sheet row number, so callers can later
// target that exact row with updateRow().
async function getRows(tabName) {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A2:Z`
  });

  const values = res.data.values || [];
  return values
    .map((row, i) => ({ rowNumber: i + 2, row }))
    // Skip fully blank rows (Sheets sometimes reports trailing empty rows).
    .filter(({ row }) => row.some(cell => cell !== undefined && cell !== ""));
}

async function appendRow(tabName, valuesArray) {
  const sheets = getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [valuesArray] }
  });
}

async function updateRow(tabName, rowNumber, valuesArray) {
  const sheets = getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [valuesArray] }
  });
}

module.exports = { getRows, appendRow, updateRow };
