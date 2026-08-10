/**
 * PMOS reusable review-session engine.
 *
 * Compact session metadata remains in Document Properties. Per-item review
 * decisions are stored in a hidden spreadsheet ledger so large reviews cannot
 * exhaust Apps Script property storage.
 */
const PMOS_REVIEW_SESSION_PROPERTY = 'PMOS_REVIEW_SESSION_V2';
const PMOS_REVIEW_DECISION_PREFIX = 'PMOS_REVIEW_DECISION_V2::';
const PMOS_REVIEW_DECISION_SHEET = 'PMOS Review Decisions';
const PMOS_REVIEW_DECISION_HEADERS = Object.freeze([
  'Session ID', 'Decision Key', 'Review Type', 'Item Key',
  'Decision', 'Updated', 'Payload JSON'
]);

function getOrBeginPmosReviewSession_(scope, sourceVersion) {
  const normalizedScope = String(scope || '').trim().toUpperCase();
  const normalizedSource = String(sourceVersion || '').trim();
  if (!normalizedScope || !normalizedSource) {
    throw new Error('Review session requires a scope and source version.');
  }
  migrateLegacyPmosReviewDecisions_();
  const properties = PropertiesService.getDocumentProperties();
  let session = loadPmosReviewSession_();
  const needsNewSession = !session || session.scope !== normalizedScope || session.status !== 'ACTIVE';
  if (needsNewSession) {
    session = {
      id: Utilities.getUuid(), scope: normalizedScope,
      sourceVersion: normalizedSource, latestPlannerVersion: normalizedSource,
      status: 'ACTIVE', createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    properties.setProperty(PMOS_REVIEW_SESSION_PROPERTY, JSON.stringify(session));
  } else if (session.latestPlannerVersion !== normalizedSource) {
    session.latestPlannerVersion = normalizedSource;
    session.updatedAt = new Date().toISOString();
    properties.setProperty(PMOS_REVIEW_SESSION_PROPERTY, JSON.stringify(session));
  }
  session.decisions = loadPmosReviewSessionDecisions_(session.id);
  return clonePmosReviewSession_(session);
}

function loadPmosReviewSession_() {
  const raw = PropertiesService.getDocumentProperties().getProperty(PMOS_REVIEW_SESSION_PROPERTY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) { return null; }
}

function requireActivePmosReviewSession_(scope) {
  const normalizedScope = String(scope || '').trim().toUpperCase();
  migrateLegacyPmosReviewDecisions_();
  const session = loadPmosReviewSession_();
  if (!session || session.status !== 'ACTIVE' || session.scope !== normalizedScope) {
    throw new Error('No active ' + normalizedScope + ' review session is available. Run the Plan Audit again.');
  }
  session.decisions = loadPmosReviewSessionDecisions_(session.id);
  return session;
}

function loadPmosReviewSessionDecisions_(sessionId) {
  const id = String(sessionId || '').trim();
  const decisions = {};
  if (!id) return decisions;
  const sheet = getPmosReviewDecisionSheet_();
  if (!sheet || sheet.getLastRow() < 2) return decisions;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, PMOS_REVIEW_DECISION_HEADERS.length).getValues();
  rows.forEach(function (row) {
    if (String(row[0] || '') !== id) return;
    const decisionKey = String(row[1] || '').trim();
    if (!decisionKey) return;
    let payload = {};
    try { payload = row[6] ? JSON.parse(String(row[6])) : {}; } catch (error) { payload = {}; }
    const record = {
      reviewType: String(row[2] || ''), itemKey: String(row[3] || ''),
      decision: String(row[4] || ''), updatedAt: normalizePmosReviewLedgerDate_(row[5])
    };
    if (payload && Object.keys(payload).length) record.payload = payload;
    decisions[decisionKey] = record;
  });
  return decisions;
}

function savePmosReviewStep_(scope, reviewType, records) {
  const session = requireActivePmosReviewSession_(scope);
  const normalizedType = String(reviewType || '').trim().toUpperCase();
  const normalizedRecords = (records || []).map(function (record) {
    return {
      reviewType: normalizedType,
      itemKey: String(record && record.itemKey || '').trim(),
      decision: String(record && record.decision || '').trim().toUpperCase(),
      payload: compactPmosReviewPayload_(record && record.payload)
    };
  });
  const saved = writePmosReviewSessionDecisions_(session, normalizedRecords);
  return {saved:true, sessionId:saved.sessionId, decisionCount:saved.decisions.length, reviewType:normalizedType};
}

function writePmosReviewSessionDecisions_(session, records) {
  const now = new Date().toISOString();
  const normalized = [];
  (records || []).forEach(function (record) {
    const reviewType = String(record && record.reviewType || '').trim().toUpperCase();
    const itemKey = String(record && record.itemKey || '').trim();
    const decision = String(record && record.decision || '').trim().toUpperCase();
    if (!reviewType || !itemKey || !decision) {
      throw new Error('Review decision is missing its type, item key, or decision.');
    }
    normalized.push({
      decisionKey: buildPmosReviewDecisionKey_(reviewType, itemKey),
      reviewType: reviewType, itemKey: itemKey, decision: decision,
      updatedAt: now, payload: compactPmosReviewPayload_(record && record.payload)
    });
  });
  upsertPmosReviewDecisionRows_(session.id, normalized);
  const metadata = {
    id:session.id, scope:session.scope, sourceVersion:session.sourceVersion,
    latestPlannerVersion:String(session.latestPlannerVersion || session.sourceVersion || ''),
    status:session.status, createdAt:session.createdAt, updatedAt:now
  };
  PropertiesService.getDocumentProperties().setProperty(PMOS_REVIEW_SESSION_PROPERTY, JSON.stringify(metadata));
  return {
    sessionId: session.id,
    decisions: normalized.map(function (record) {
      const saved = {reviewType:record.reviewType,itemKey:record.itemKey,decision:record.decision,updatedAt:record.updatedAt};
      if (Object.keys(record.payload).length) saved.payload = record.payload;
      return saved;
    })
  };
}

function upsertPmosReviewDecisionRows_(sessionId, records) {
  if (!(records || []).length) return;
  const sheet = ensurePmosReviewDecisionSheet_();
  const rowByKey = {};
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(function (row, index) {
      if (String(row[0] || '') !== String(sessionId || '')) return;
      const key = String(row[1] || '').trim();
      if (key) rowByKey[key] = index + 2;
    });
  }
  const updates = [], appends = [];
  records.forEach(function (record) {
    const row = [String(sessionId || ''),record.decisionKey,record.reviewType,record.itemKey,
      record.decision,record.updatedAt,Object.keys(record.payload).length ? JSON.stringify(record.payload) : ''];
    const existingRow = rowByKey[record.decisionKey];
    if (existingRow) updates.push({row:existingRow,values:row}); else appends.push(row);
  });
  updates.forEach(function (update) {
    sheet.getRange(update.row, 1, 1, PMOS_REVIEW_DECISION_HEADERS.length).setValues([update.values]);
  });
  if (appends.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, appends.length, PMOS_REVIEW_DECISION_HEADERS.length).setValues(appends);
  }
  if (!sheet.isSheetHidden()) sheet.hideSheet();
}

function getPmosReviewDecisionSheet_() {
  return SpreadsheetApp.getActive().getSheetByName(PMOS_REVIEW_DECISION_SHEET);
}

function ensurePmosReviewDecisionSheet_() {
  const spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getSheetByName(PMOS_REVIEW_DECISION_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(PMOS_REVIEW_DECISION_SHEET);
  if (sheet.getMaxColumns() < PMOS_REVIEW_DECISION_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), PMOS_REVIEW_DECISION_HEADERS.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, PMOS_REVIEW_DECISION_HEADERS.length).setValues([PMOS_REVIEW_DECISION_HEADERS.slice()]);
  if (!sheet.isSheetHidden()) sheet.hideSheet();
  return sheet;
}

function migrateLegacyPmosReviewDecisions_() {
  const properties = PropertiesService.getDocumentProperties();
  const all = properties.getProperties();
  const legacyKeys = Object.keys(all).filter(function (key) {
    return key.indexOf(PMOS_REVIEW_DECISION_PREFIX) === 0;
  });
  if (!legacyKeys.length) return {migrated:0};
  const grouped = {}, migratedKeys = [];
  legacyKeys.forEach(function (propertyKey) {
    const suffix = propertyKey.slice(PMOS_REVIEW_DECISION_PREFIX.length);
    const divider = suffix.indexOf('::');
    if (divider < 0) return;
    const sessionId = suffix.slice(0, divider);
    try {
      const record = JSON.parse(all[propertyKey]);
      const reviewType = String(record && record.reviewType || '').trim().toUpperCase();
      const itemKey = String(record && record.itemKey || '').trim();
      const decision = String(record && record.decision || '').trim().toUpperCase();
      if (!sessionId || !reviewType || !itemKey || !decision) return;
      if (!grouped[sessionId]) grouped[sessionId] = [];
      grouped[sessionId].push({
        decisionKey:buildPmosReviewDecisionKey_(reviewType,itemKey),reviewType:reviewType,
        itemKey:itemKey,decision:decision,updatedAt:String(record.updatedAt || new Date().toISOString()),
        payload:compactPmosReviewPayload_(record.payload)
      });
      migratedKeys.push(propertyKey);
    } catch (error) {}
  });
  Object.keys(grouped).forEach(function (sessionId) {
    upsertPmosReviewDecisionRows_(sessionId, grouped[sessionId]);
  });
  migratedKeys.forEach(function (propertyKey) { properties.deleteProperty(propertyKey); });
  return {migrated:migratedKeys.length};
}

function normalizePmosReviewLedgerDate_(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  return String(value || '');
}

function compactPmosReviewPayload_(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const allowed = ['customerId','customerName','customerTitle','customerAddress','eventId','seriesId','seriesKey','operationId','title','start','end','location'];
  const compact = {};
  allowed.forEach(function (key) {
    const value = source[key];
    if (value === '' || value == null) return;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') compact[key] = String(value).slice(0,500);
  });
  return compact;
}

function readPmosReviewSessionDecision_(session, reviewType, itemKey) {
  if (!session || !session.decisions) return null;
  return session.decisions[buildPmosReviewDecisionKey_(reviewType,itemKey)] || null;
}

function completePmosReviewSession_() {
  const session = loadPmosReviewSession_();
  if (!session) return {completed:false};
  session.status='COMPLETE'; session.completedAt=new Date().toISOString(); session.updatedAt=session.completedAt;
  PropertiesService.getDocumentProperties().setProperty(PMOS_REVIEW_SESSION_PROPERTY,JSON.stringify(session));
  return {completed:true,sessionId:session.id};
}

function buildPmosReviewDecisionKey_(reviewType,itemKey) {
  return String(reviewType || '').trim().toUpperCase() + '::' + String(itemKey || '').trim();
}

function clonePmosReviewSession_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
