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

const PMOS_JOB_STATE_KEY = 'PMOS_ACTIVE_JOB_V1';
const PMOS_JOB_TRIGGER_HANDLER = 'runPmosJobTrigger_';
const PMOS_JOB_HISTORY_SHEET = 'PMOS Job History';


const PMOS_JOB_TYPES = {
  CALENDAR_SYNC: {
    label: 'Calendar Sync',
    description: 'Create, update, and remove recurring Calendar series to match the verified plan.',
    supportsAuto: true
  },
  CALENDAR_REBUILD: {
    label: 'Calendar Rebuild',
    description: 'Delete PMOS-managed recurring series and recreate the verified four-week plan.',
    supportsAuto: true
  },
  VERIFY_CALENDAR: {
    label: 'Verify Calendar',
    description: 'Compare the verified plan, registry, and Calendar and report missing or mismatched series.',
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
};

const PMOS_TEMP_VISIT_MARKER = 'PMOS_TEMP_VISIT=true';

const PMOS_CALENDAR_AUTO_JOB = 'PMOS_CALENDAR_AUTO_JOB';
const PMOS_CALENDAR_AUTO_HANDLER = 'runCalendarAutoContinueTrigger';

const PMOS_CALENDAR_REBUILD_STATE = 'PMOS_CALENDAR_REBUILD_STATE';

