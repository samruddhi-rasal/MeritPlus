const crypto = require("crypto");
const { getRows, appendRow, updateRow } = require("./client");
const { toObject, toArray } = require("./helpers");

const TAB = "PasswordResets";
const COLUMNS = ["id", "user_id", "token_hash", "created_at", "expires_at", "used_at"];

function parse(rowNumber, row) {
  return { rowNumber, ...toObject(COLUMNS, row) };
}

async function create({ userId, tokenHash, expiresAt }) {
  const record = {
    id: crypto.randomUUID(),
    user_id: userId,
    token_hash: tokenHash,
    created_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    used_at: ""
  };
  await appendRow(TAB, toArray(COLUMNS, record));
}

// Mirrors: SELECT ... WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
async function findValidByTokenHash(tokenHash) {
  const rows = await getRows(TAB);
  const now = Date.now();

  const match = rows.find(({ row }) => {
    const r = parse(null, row);
    return r.token_hash === tokenHash && !r.used_at && new Date(r.expires_at).getTime() > now;
  });

  return match ? parse(match.rowNumber, match.row) : null;
}

async function markUsed(record) {
  const updated = { ...record, used_at: new Date().toISOString() };
  await updateRow(TAB, record.rowNumber, toArray(COLUMNS, updated));
}

module.exports = { create, findValidByTokenHash, markUsed };
