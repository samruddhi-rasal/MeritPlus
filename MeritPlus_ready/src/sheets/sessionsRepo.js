const { getRows, appendRow, updateRow } = require("./client");
const { toObject, toArray } = require("./helpers");

const TAB = "Sessions";
const COLUMNS = [
  "id", "user_id", "session_id", "ip_address", "user_agent",
  "created_at", "expires_at", "logged_out_at"
];

function parseSession(rowNumber, row) {
  return { rowNumber, ...toObject(COLUMNS, row) };
}

async function create({ id, userId, sessionId, ipAddress, userAgent, expiresAt }) {
  const session = {
    id,
    user_id: userId,
    session_id: sessionId,
    ip_address: ipAddress || "",
    user_agent: userAgent || "",
    created_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    logged_out_at: ""
  };
  await appendRow(TAB, toArray(COLUMNS, session));
}

// Mirrors: SELECT ... WHERE user_id = ? AND session_id = ? AND logged_out_at IS NULL AND expires_at > NOW()
async function findActive(userId, sessionId) {
  const rows = await getRows(TAB);
  const now = Date.now();

  const match = rows.find(({ row }) => {
    const s = parseSession(null, row);
    return (
      s.user_id === userId &&
      s.session_id === sessionId &&
      !s.logged_out_at &&
      new Date(s.expires_at).getTime() > now
    );
  });

  return match ? parseSession(match.rowNumber, match.row) : null;
}

async function logout(userId, sessionId) {
  const rows = await getRows(TAB);
  const match = rows.find(({ row }) => row[1] === userId && row[2] === sessionId);
  if (!match) return;

  const session = parseSession(match.rowNumber, match.row);
  session.logged_out_at = new Date().toISOString();
  await updateRow(TAB, match.rowNumber, toArray(COLUMNS, session));
}

// Used when a password is reset — invalidates every still-active session for that user.
async function invalidateAllForUser(userId) {
  const rows = await getRows(TAB);
  const nowIso = new Date().toISOString();

  const active = rows.filter(({ row }) => row[1] === userId && !row[7]);

  for (const { rowNumber, row } of active) {
    const session = parseSession(rowNumber, row);
    session.logged_out_at = nowIso;
    await updateRow(TAB, rowNumber, toArray(COLUMNS, session));
  }
}

module.exports = { create, findActive, logout, invalidateAllForUser };
