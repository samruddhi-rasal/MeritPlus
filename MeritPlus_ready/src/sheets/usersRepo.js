const crypto = require("crypto");
const { getRows, appendRow, updateRow } = require("./client");
const { toObject, toArray } = require("./helpers");

const TAB = "Users";
const COLUMNS = ["id", "first_name", "last_name", "email", "password_hash", "is_active", "created_at"];

function parseUser(rowNumber, row) {
  const obj = toObject(COLUMNS, row);
  return {
    rowNumber,
    id: obj.id,
    first_name: obj.first_name,
    last_name: obj.last_name,
    email: obj.email,
    password_hash: obj.password_hash,
    is_active: String(obj.is_active).toUpperCase() !== "FALSE", // defaults to active
    created_at: obj.created_at
  };
}

async function findByEmail(email) {
  const rows = await getRows(TAB);
  const target = email.toLowerCase().trim();
  const match = rows.find(({ row }) => (row[3] || "").toLowerCase().trim() === target);
  return match ? parseUser(match.rowNumber, match.row) : null;
}

async function findById(id) {
  const rows = await getRows(TAB);
  const match = rows.find(({ row }) => row[0] === id);
  return match ? parseUser(match.rowNumber, match.row) : null;
}

async function create({ firstName, lastName, email, passwordHash }) {
  const id = crypto.randomUUID();
  const user = {
    id,
    first_name: firstName,
    last_name: lastName,
    email: email.toLowerCase().trim(),
    password_hash: passwordHash,
    is_active: "TRUE",
    created_at: new Date().toISOString()
  };
  await appendRow(TAB, toArray(COLUMNS, user));
  return { id, first_name: firstName, last_name: lastName, email: user.email, is_active: true };
}

async function updatePasswordHash(id, passwordHash) {
  const rows = await getRows(TAB);
  const match = rows.find(({ row }) => row[0] === id);
  if (!match) return;

  const user = parseUser(match.rowNumber, match.row);
  const updated = { ...user, password_hash: passwordHash };
  await updateRow(TAB, match.rowNumber, toArray(COLUMNS, updated));
}

module.exports = { findByEmail, findById, create, updatePasswordHash };
