/** Shared date parsing for the active Temporary Maintenance scheduler. */

function parseTemporaryVisitDate_(value) {
  const match = String(value || '').match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );


  if (!match) {
    throw new Error(`Invalid visit date: ${value}`);
  }


  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0
  );


  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid visit date: ${value}`);
  }


  return date;
}
