/**
 * PMOS v1.9.0 — Constants and configuration.
 * Spreadsheet data remains the authoritative source of truth.
 */

const PMOS_VERSION = '1.9.0';

// Active recurring-calendar rotation anchor:
// Monday July 13, 2026 is Week 1, so the first new visits begin
// Thursday July 16, 2026 in Week 1.
const PMOS_RECURRING_WEEK1_MONDAY = new Date(2026, 6, 13, 12, 0, 0, 0);

const PMOS_MIN_SCHEMA_VERSION = 5;

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

const PMOS_CHEMISTRY = {
  PRODUCTS_SHEET: 'Chemical Products',
  USAGE_SHEET: 'Chemical Usage'
};

/** Legacy generic Job Engine state retained only for upgrade compatibility. */
const PMOS_JOB_STATE_KEY = 'PMOS_ACTIVE_JOB_V1';
const PMOS_JOB_TRIGGER_HANDLER = 'runPmosJobTrigger_';
const PMOS_JOB_HISTORY_SHEET = 'PMOS Job History';

/**
 * Non-destructive compatibility inventory. Calendar Sync itself is executed by
 * the reviewed queue worker, not by the legacy generic Job Engine.
 */
const PMOS_JOB_TYPES = Object.freeze({
  CALENDAR_SYNC: {
    label: 'Calendar Sync',
    description: 'Reviewed Calendar synchronization.',
    supportsAuto: false
  },
  VERIFY_CALENDAR: {
    label: 'Verify Calendar',
    description: 'Compare the verified plan, registry, and Calendar.',
    supportsAuto: false
  },
  CUSTOMER_SYNC: {
    label: 'Sync Customer Database',
    description: 'Generate IDs and propagate current customer information into routes and PMOS.',
    supportsAuto: false
  },
  MAP_EXPORT: {
    label: 'Export Updated Map Layers',
    description: 'Export the currently affected route layers into a new Drive folder.',
    supportsAuto: false
  }
});

const PMOS_TEMP_VISIT_MARKER = 'PMOS_TEMP_VISIT=true';
