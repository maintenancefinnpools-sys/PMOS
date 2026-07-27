/**
 * Audit navigation and Calendar Repair inclusion fixes.
 */

/**
 * Unique audit launcher. It opens Calendar Sync through the canonical Job
 * Engine entry without starting the job.
 */
function openIntegratedCalendarSyncFromAudit() {
  const audit = runCalendarPlanAudit_();
  if (!audit.canSync) {
    throw new Error(`Calendar Plan Audit still has ${audit.errorCount} blocking error(s).`);
  }
  saveCalendarSyncEffectiveDate(Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd'));
  openPmosJobEngine('CALENDAR_SYNC');
  return {
    opened: true,
    selectedType: 'CALENDAR_SYNC',
    summary: 'Calendar Sync opened in the PMOS Job Engine.'
  };
}

function startCalendarSyncFromAudit() {
  const today = Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
  let result;
  try {
    result = startCalendarSyncFromDate(today, true);
  } finally {
    openPmosJobEngine('CALENDAR_SYNC');
  }
  return result;
}

function openCalendarSync() {
  return startCalendarSyncFromAudit();
}

function showCalendarSync() {
  return startCalendarSyncFromAudit();
}

function openPmosCalendarSync() {
  return startCalendarSyncFromAudit();
}

function startCalendarSyncWithEffectiveDate(value, autoMode) {
  return startCalendarSyncFromDate(value, Boolean(autoMode));
}

function isRepairRelevantCalendarEvent_(event) {
  if (!event || event.isAllDayEvent()) return false;
  const start = event.getStartTime();
  const end = event.getEndTime();
  if (!(start instanceof Date) || !(end instanceof Date)) return false;
  const startDate = Utilities.formatDate(start, PMOS.TIMEZONE, 'yyyy-MM-dd');
  const endDate = Utilities.formatDate(end, PMOS.TIMEZONE, 'yyyy-MM-dd');
  return startDate === endDate;
}

function repairCalendarManagedDayEvents_(calendar, dateText) {
  const bounds = repairCalendarDayBounds_(dateText);
  return calendar.getEvents(bounds.start, bounds.end)
    .filter(isRepairRelevantCalendarEvent_)
    .sort((a, b) => a.getStartTime().getTime() - b.getStartTime().getTime());
}

function getCalendarRepairExistingVisitCards_(start, end) {
  const calendar = getRecurringCalendar_();
  const queryEnd = new Date(end);
  queryEnd.setDate(queryEnd.getDate() + 1);
  return calendar.getEvents(start, queryEnd)
    .filter(isRepairRelevantCalendarEvent_)
    .map(event => ({
      id: 'existing-' + event.getId(),
      title: event.getTitle(),
      date: Utilities.formatDate(event.getStartTime(), PMOS.TIMEZONE, 'yyyy-MM-dd'),
      startMs: event.getStartTime().getTime(),
      existing: true
    }));
}

function suggestMaintenanceClientPlacement(input) {
  input = input || {};
  const frequency = normalizeMaintenanceFrequency_(input.frequency);
  const day = normalizeMaintenanceDay_(input.day);
  if (frequency === 'Weekly' || frequency === 'Twice Weekly') {
    return {
      week: 1,
      summary: frequency === 'Twice Weekly'
        ? 'Twice-weekly service uses both selected weekdays in every rotation week, so no rotation choice is required.'
        : 'Weekly service uses every rotation week, so no rotation choice is required.'
    };
  }

  const address = String(input.address || '').trim();
  if (!address) throw new Error('Enter the service address before requesting a geographic suggestion.');
  const ss = SpreadsheetApp.getActive();
  const routeSheet = findFirstSheetByName_(ss, ['4-Week Route Template','PMOS 4-Week Route Template','Route Template']);
  if (!routeSheet) throw new Error('4-Week Route Template sheet was not found.');

  const table = readHeaderTable_(routeSheet);
  const targetPoint = maintenanceGeocodeAddress_(address);
  const candidates = frequency === 'Biweekly' ? [[1,3],[2,4]] : [[1],[2],[3],[4]];
  const scored = candidates.map(weeks => maintenanceRotationGeography_(table, day, weeks, targetPoint));
  scored.sort(compareMaintenanceGeography_);
  const best = scored[0];
  const rotationText = best.weeks.length === 2
    ? `Weeks ${best.weeks[0]} and ${best.weeks[1]}`
    : `Week ${best.weeks[0]}`;
  const lines = [`Suggested ${day} rotation: ${rotationText}.`];
  if (best.nearest != null) {
    lines.push(`Nearest existing ${day} stop is approximately ${best.nearest.toFixed(1)} km away.`);
    lines.push(`${best.nearby} existing stop(s) are within about 8 km.`);
  }
  lines.push(`Current stop count in that rotation: ${best.stops}.`);
  lines.push('Geographic proximity is ranked before stop-count balance.');
  return {week: best.weeks[0], summary: lines.join('\n')};
}
