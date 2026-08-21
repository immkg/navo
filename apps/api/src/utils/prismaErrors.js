// P2025: record to update/delete not found.
// P2003: foreign key constraint failed (e.g. workId points at a row that doesn't exist).
// P2016: query interpretation error from a nested connect/create against a missing parent.
// All three mean the same thing to an API caller: the referenced record doesn't exist.
const NOT_FOUND_CODES = new Set(["P2025", "P2003", "P2016"]);

function isRecordNotFoundError(error) {
  return NOT_FOUND_CODES.has(error?.code);
}

module.exports = { isRecordNotFoundError };
