// Run once, after creating an empty Google Sheet and sharing it with your
// service account email: `node scripts/setup-sheet.js`
//
// Creates four tabs (Users, Sessions, PasswordResets, History) with header
// rows matching what src/sheets/*Repo.js expect, if they don't exist yet.

require("dotenv").config();
const { google } = require("googleapis");

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

const TABS = {
  Users: ["id", "first_name", "last_name", "email", "password_hash", "is_active", "created_at"],
  Sessions: [
    "id", "user_id", "session_id", "ip_address", "user_agent",
    "created_at", "expires_at", "logged_out_at"
  ],
  PasswordResets: ["id", "user_id", "token_hash", "created_at", "expires_at", "used_at"],
  History: [
    "id", "user_id", "session_id", "company_name", "job_title", "location",
    "apply_link", "resume_url", "cover_letter_url", "resume_content",
    "cover_letter_content", "generated_at"
  ]
};

async function main() {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.error("Missing GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY in .env");
    process.exit(1);
  }

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const sheets = google.sheets({ version: "v4", auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingTabs = new Set(meta.data.sheets.map(s => s.properties.title));

  const tabsToCreate = Object.keys(TABS).filter(name => !existingTabs.has(name));

  if (tabsToCreate.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: tabsToCreate.map(title => ({ addSheet: { properties: { title } } }))
      }
    });
    console.log(`Created tabs: ${tabsToCreate.join(", ")}`);
  }

  for (const [tabName, headers] of Object.entries(TABS)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] }
    });
    console.log(`Wrote header row for ${tabName}`);
  }

  console.log("Done. Your sheet is ready to use.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
