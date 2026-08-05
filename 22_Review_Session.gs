/**
 * PMOS reusable review-session engine.
 *
 * A session survives planner ID changes while the underlying source version is
 * unchanged. Decisions are keyed by review type and stable item identity.
 */
const PMOS_REVIEW_SESSION_PROPERTY = 'PMOS_REVIEW_SESSION_V1';

function getOrBeginPmosReviewSession_(scope, sourceVersion) {
  const normalizedScope = String(scope || '').trim().toUpperCase();
  const normalizedSource = String(sourceVersion || '').trim();
  if (!normalizedScope || !normalizedSource) {
    throw new Error('Review session requires a scope and source version.');
  }

  const properties = PropertiesService.getDocumentProperties();
  let session = loadPmosReviewSession_();
  if (!session || session.scope !== normalizedScope ||
      session.sourceVersion !== normalizedSource || session.status !== 'ACTIVE') {
    session = {
      id: Utilities.getUuid(),
      scope: normalizedScope,
      sourceVersion: normalizedSource,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      decisions: importLegacyPmosReviewDecisions_()
    };
    properties.setProperty(PMOS_REVIEW_SESSION_PROPERTY, JSON.stringify(session));
  }
  return refreshPmosReviewSessionFromLegacy_(session);
}

function loadPmosReviewSession_() {
  const raw = PropertiesService.getDocumentProperties()
    .getProperty(PMOS_REVIEW_SESSION_PROPERTY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    return null;
  }
}

function refreshPmosReviewSessionFromLegacy_(session) {
  const refreshed = clonePmosReviewSession_(session);
  const imported = importLegacyPmosReviewDecisions_();
  let changed = false;
  Object.keys(imported).forEach(function (key) {
    const incoming = imported[key];
    const existing = refreshed.decisions[key];
    if (!existing || String(incoming.updatedAt || '') >= String(existing.updatedAt || '')) {
      refreshed.decisions[key] = incoming;
      changed = true;
    }
  });
  if (changed) {
    refreshed.updatedAt = new Date().toISOString();
    PropertiesService.getDocumentProperties().setProperty(
      PMOS_REVIEW_SESSION_PROPERTY,
      JSON.stringify(refreshed)
    );
  }
  return clonePmosReviewSession_(refreshed);
}

function savePmosReviewSessionDecision_(scope, sourceVersion, reviewType, itemKey, decision, payload) {
  const session = getOrBeginPmosReviewSession_(scope, sourceVersion);
  const key = buildPmosReviewDecisionKey_(reviewType, itemKey);
  session.decisions[key] = {
    reviewType: String(reviewType || '').trim().toUpperCase(),
    itemKey: String(itemKey || '').trim(),
    decision: String(decision || '').trim().toUpperCase(),
    payload: payload || {},
    updatedAt: new Date().toISOString()
  };
  session.updatedAt = new Date().toISOString();
  PropertiesService.getDocumentProperties().setProperty(
    PMOS_REVIEW_SESSION_PROPERTY,
    JSON.stringify(session)
  );
  return clonePmosReviewSession_(session.decisions[key]);
}

function readPmosReviewSessionDecision_(session, reviewType, itemKey) {
  if (!session || !session.decisions) return null;
  return session.decisions[buildPmosReviewDecisionKey_(reviewType, itemKey)] || null;
}

function invalidatePmosReviewSession_(reason) {
  const session = loadPmosReviewSession_();
  if (!session) return {invalidated: false};
  session.status = 'INVALIDATED';
  session.invalidatedAt = new Date().toISOString();
  session.invalidationReason = String(reason || 'Underlying data changed.');
  PropertiesService.getDocumentProperties().setProperty(
    PMOS_REVIEW_SESSION_PROPERTY,
    JSON.stringify(session)
  );
  return {invalidated: true, sessionId: session.id};
}

function completePmosReviewSession_() {
  const session = loadPmosReviewSession_();
  if (!session) return {completed: false};
  session.status = 'COMPLETE';
  session.completedAt = new Date().toISOString();
  session.updatedAt = session.completedAt;
  PropertiesService.getDocumentProperties().setProperty(
    PMOS_REVIEW_SESSION_PROPERTY,
    JSON.stringify(session)
  );
  return {completed: true, sessionId: session.id};
}

function buildPmosReviewDecisionKey_(reviewType, itemKey) {
  return String(reviewType || '').trim().toUpperCase() + '::' +
    String(itemKey || '').trim();
}

/** Imports current hidden-sheet decisions into the active review session. */
function importLegacyPmosReviewDecisions_() {
  const imported = {};
  if (typeof readPmosCalendarReviewDecisions_ !== 'function') return imported;
  const legacy = readPmosCalendarReviewDecisions_() || {};
  Object.keys(legacy).forEach(function (legacyKey) {
    const record = legacy[legacyKey] || {};
    const reviewType = String(record.reviewType || legacyKey.split('::')[0] || '')
      .trim().toUpperCase();
    const itemKey = String(record.seriesKey || legacyKey.split('::').slice(1).join('::') || '')
      .trim();
    if (!reviewType || !itemKey) return;
    imported[buildPmosReviewDecisionKey_(reviewType, itemKey)] = {
      reviewType: reviewType,
      itemKey: itemKey,
      decision: String(record.decision || '').trim().toUpperCase(),
      payload: record,
      updatedAt: String(record.updatedAt || '')
    };
  });
  return imported;
}

function clonePmosReviewSession_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
