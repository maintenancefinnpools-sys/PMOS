/**
 * Canonical PMOS Job Engine entry point.
 *
 * UI ownership currently remains in 07-C while the persistent Job Engine core
 * remains in 07-A. All menus and new callers should enter through this file.
 */

function openPmosJobEngine(initialType) {
  return showIntegratedPmosJobEngine(normalizePmosJobEngineType_(initialType));
}

function normalizePmosJobEngineType_(type) {
  const requested = String(type || '').trim();

  // Calendar Rebuild is obsolete. Older callers are redirected to the safer
  // future-only reconciliation workflow rather than exposing the old UI.
  if (requested === 'CALENDAR_REBUILD') return 'RECONCILE_FUTURE';

  const allowed = {
    CALENDAR_STATUS: true,
    VERIFY_CALENDAR: true,
    CALENDAR_SYNC: true,
    RECONCILE_FUTURE: true,
    CALENDAR_REPAIR: true,
    CUSTOMER_SYNC: true,
    MAP_EXPORT: true
  };

  return allowed[requested] ? requested : 'CALENDAR_STATUS';
}
