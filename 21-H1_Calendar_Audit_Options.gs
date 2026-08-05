/** Calendar Plan Audit options retained for one active review operation. */
const PMOS_CALENDAR_AUDIT_OPTIONS_PROPERTY = 'PMOS_CALENDAR_AUDIT_OPTIONS';

function savePmosCalendarAuditOptions_(options) {
  const normalized = {
    includeStartedToday: Boolean(options && options.includeStartedToday)
  };
  PropertiesService.getDocumentProperties().setProperty(
    PMOS_CALENDAR_AUDIT_OPTIONS_PROPERTY,
    JSON.stringify(normalized)
  );
  return normalized;
}

function readPmosCalendarAuditOptions_() {
  const raw = PropertiesService.getDocumentProperties().getProperty(
    PMOS_CALENDAR_AUDIT_OPTIONS_PROPERTY
  );
  if (!raw) return {includeStartedToday: false};
  try {
    const parsed = JSON.parse(raw);
    return {includeStartedToday: parsed && parsed.includeStartedToday === true};
  } catch (error) {
    return {includeStartedToday: false};
  }
}

function clearPmosCalendarAuditOptions_() {
  PropertiesService.getDocumentProperties().deleteProperty(
    PMOS_CALENDAR_AUDIT_OPTIONS_PROPERTY
  );
}

function runFreshPmosCalendarAuditWithOptions(options) {
  const normalized = savePmosCalendarAuditOptions_(options || {});
  return runVerifiedCalendarPlanAuditReadOnly_(normalized);
}
