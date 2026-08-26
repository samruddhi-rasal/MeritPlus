const crypto = require("crypto");
const { getRows, appendRow } = require("./client");
const { toObject, toArray } = require("./helpers");

const TAB = "History";
const COLUMNS = [
  "id", "user_id", "session_id", "company_name", "job_title", "location",
  "apply_link", "resume_url", "cover_letter_url", "resume_content",
  "cover_letter_content", "generated_at"
];

async function create(entry) {
  const record = {
    id: crypto.randomUUID(),
    user_id: entry.userId,
    session_id: entry.sessionId,
    company_name: entry.companyName || "",
    job_title: entry.jobTitle || "",
    location: entry.location || "",
    apply_link: entry.applyLink || "",
    resume_url: entry.resumeUrl || "",
    cover_letter_url: entry.coverLetterUrl || "",
    resume_content: entry.resumeContent || "",
    cover_letter_content: entry.coverLetterContent || "",
    generated_at: new Date().toISOString()
  };
  await appendRow(TAB, toArray(COLUMNS, record));
}

// Mirrors: SELECT ... WHERE user_id = ? ORDER BY generated_at DESC
async function listByUser(userId) {
  const rows = await getRows(TAB);
  return rows
    .map(({ row }) => toObject(COLUMNS, row))
    .filter(r => r.user_id === userId)
    .sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at));
}

module.exports = { create, listByUser };
