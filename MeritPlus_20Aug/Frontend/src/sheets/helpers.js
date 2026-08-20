function toObject(columns, rowArray = []) {
  const obj = {};
  columns.forEach((col, i) => {
    obj[col] = rowArray[i] !== undefined ? rowArray[i] : "";
  });
  return obj;
}

function toArray(columns, obj = {}) {
  return columns.map(col => {
    const val = obj[col];
    return val === undefined || val === null ? "" : val;
  });
}

module.exports = { toObject, toArray };
