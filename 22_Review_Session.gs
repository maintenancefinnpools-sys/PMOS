/**
 * PMOS reusable review-session engine.
 *
 * Session metadata is stored separately from compact per-item decisions so a
 * large Calendar review cannot exceed the Apps Script property value limit.
 */
const PMOS_REVIEW_SESSION_PROPERTY = 'PMOS_REVIEW_SESSION_V2';
const PMOS_REVIEW_DECISION_PREFIX = 'PMOS_REVIEW_DECISION_V2::';

function getOrBeginPmosReviewSession_(scope, sourceVersion) {
  const normalizedScope = String(scope || '').trim().toUpperCase();
  const normalizedSource = String(sourceVersion || '').trim();
  if (!normalizedScope || !normalizedSource) {
    throw new Error('Review session requires a scope and source version.');
  }

  const properties = PropertiesService.getDocumentProperties();
  let session = loadPmosReviewSession_();

  // Planner IDs and planner source-version values may change whenever an audit
  // is rebuilt. They do not, by themselves, prove that the underlying Calendar
  // or spreadsheet data changed. Preserve an active session for the same scope
  // until an operation explicitly invalidates or completes it.
  const needsNewSession = !session ||
    session.scope !== normalizedScope ||
    session.status !== 'ACTIVE';

  if (needsNewSession) {
    session = {
      id: Utilities.getUuid(),
      scope: normalizedScope,
      sourceVersion: normalizedSource,
      latestPlannerVersion: normalizedSource,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
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

function loadPmosReviewSessionDecisions_(sessionId) {
  const prefix = PMOS_REVIEW_DECISION_PREFIX + String(sessionId || '') + '::';
  const properties = PropertiesService.getDocumentProperties().getProperties();
  const decisions = {};
  Object.keys(properties).forEach(function (propertyKey) {
    if (propertyKey.indexOf(prefix) !== 0) return;
    try {
      const record = JSON.parse(properties[propertyKey]);
      const decisionKey = propertyKey.slice(prefix.length);
      if (record && decisionKey) decisions[decisionKey] = record;
    } catch (error) {
      // Ignore one malformed decision rather than invalidating the whole session.
    }
  });
  return decisions;
}

function savePmosReviewSessionDecision_(scope, sourceVersion, reviewType, itemKey, decision, payload) {
  const saved = savePmosReviewSessionDecisions_(scope, sourceVersion, [{
    reviewType: reviewType,
    itemKey: itemKey,
    decision: decision,
    payload: payload
  }]);
  return saved.decisions[0];
}

function savePmosReviewSessionDecisions_(scope, sourceVersion, records) {
  const session = getOrBeginPmosReviewSession_(scope, sourceVersion);
  const now = new Date().toISOString();
  const propertiesToWrite = {};
  const saved = [];

  (records || []).forEach(function (record) {
    const reviewType = String(record && record.reviewType || '').trim().toUpperCase();
    const itemKey = String(record && record.itemKey || '').trim();
    const decision = String(record && record.decision || '').trim().toUpperCase();
    if (!reviewType || !itemKey || !decision) {
      throw new Error('Review decision is missing its type, item key, or decision.');
    }

    const decisionKey = buildPmosReviewDecisionKey_(reviewType, itemKey);
    const compact = {
      reviewType: reviewType,
      itemKey: itemKey,
      decision: decision,
      updatedAt: now
    };
    propertiesToWrite[
      PMOS_REVIEW_DECISION_PREFIX + session.id + '::' + decisionKey
    ] = JSON.stringify(compact);
    saved.push(compact);
  });

  const metadata = {
    id: session.id,
    scope: session.scope,
    sourceVersion: session.sourceVersion,
    latestPlannerVersion: String(sourceVersion || session.latestPlannerVersion || ''),
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: now
  };
  propertiesToWrite[PMOS_REVIEW_SESSION_PROPERTY] = JSON.stringify(metadata);
  PropertiesService.getDocumentProperties().setProperties(propertiesToWrite, false);

  return {sessionId: session.id, decisions: saved};
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
  session.updatedAt = session.invalidatedAt;
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

function clonePmosReviewSession_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
