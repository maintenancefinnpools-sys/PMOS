/**
 * PMOS v1.9.0 — Shared stateless utilities.
 * Move-only refactor: public names and operational behavior are preserved.
 */

function sameLocalDate_(left, right) {
  return Utilities.formatDate(left, PMOS.TIMEZONE, 'yyyy-MM-dd') ===
    Utilities.formatDate(right, PMOS.TIMEZONE, 'yyyy-MM-dd');
}

function parseLayer_(layer) {
  const match = String(layer).match(/^Week\s+(\d+)\s+-\s+(.+)$/i);
  if (!match) throw new Error(`Cannot parse layer: ${layer}`);


  return {
    week: Number(match[1]),
    routeDay: match[2],
    day: match[2].split(' - ')[0].trim()
  };
}

function parseTime_(text) {
  const match = String(text).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hours: 6, minutes: 0 };


  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const suffix = match[3].toUpperCase();


  if (suffix === 'PM' && hours !== 12) hours += 12;
  if (suffix === 'AM' && hours === 12) hours = 0;


  return { hours, minutes };
}

function routeSort_(a, b) {
  const left = parseLayer_(a);
  const right = parseLayer_(b);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];


  return left.week - right.week ||
    days.indexOf(left.day) - days.indexOf(right.day) ||
    a.localeCompare(b);
}

function setByHeader_(row, headers, header, value) {
  const index = headers.indexOf(header);
  if (index >= 0) row[index] = value;
}

function normalize_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2011\u2013\u2014-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function csvRow_(row) {
  return row.map(value =>
    `"${String(value == null ? '' : value).replace(/"/g, '""')}"`
  ).join(',');
}

function safeFilename_(value) {
  return String(value)
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_');
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

