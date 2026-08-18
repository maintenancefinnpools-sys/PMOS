/**
 * PMOS v1.9.0 — Constants and configuration.
 * Spreadsheet data remains the authoritative source of truth.
 */

const PMOS_VERSION = '1.10.0';

// Active recurring-calendar rotation anchor:
// Monday July 13, 2026 is Week 1, so the first new visits begin
// Thursday July 16, 2026 in Week 1.
const PMOS_RECURRING_WEEK1_MONDAY = new Date(2026, 6, 13, 12, 0, 0, 0);

const PMOS_MIN_SCHEMA_VERSION = 6;

const PMOS = {
  ROUTES_SHEET: '4-Week Route Template',
  CUSTOMERS_SHEET: 'Customers',
  SETTINGS_SHEET: 'App Settings',
  VERSIONS_SHEET: 'Route Versions',
  PENDING_SHEET: 'Pending Route Changes',
  STATUS_SHEET: 'Sync Status',
  CALENDAR_NAME: 'Water Maintenance Routes',
  TIMEZONE: 'America/Toronto',
  CHANGE_TRIGGER_HANDLER: 'handlePmosSheetChange',
  EDIT_TRIGGER_HANDLER: 'handlePmosSheetEdit'
};

const PMOS_RIE_CACHE_SHEET = 'PMOS Route Cache';
const PMOS_RIE_CACHE_HEADERS = [
  'Cache Key', 'Origin Latitude', 'Origin Longitude',
  'Destination Latitude', 'Destination Longitude',
  'Distance Metres', 'Duration Milliseconds', 'Provider', 'Profile', 'Calculated At'
];

const PMOS_CHEMISTRY = {
  PRODUCTS_SHEET: 'Chemical Products',
  USAGE_SHEET: 'Chemical Usage'
};

/** Shared history sheet used by current Operations/Job Center views. */
const PMOS_JOB_HISTORY_SHEET = 'PMOS Job History';

const PMOS_TEMP_VISIT_MARKER = 'PMOS_TEMP_VISIT=true';
