/**
 * Calendar Review Session -> Calendar Sync adapter.
 *
 * This module is read-only. It normalizes the active Review Session into a
 * stable structure the planner and executor can consume without knowing how
 * review decisions are stored.
 */
function readActivePmosCalendarReviewDecisions_() {
  const session = requireActivePmosReviewSession_('CALENDAR');
  const decisions = session.decisions || {};
  const result = {
    sessionId: String(session.id || ''),
    sourceVersion: String(session.sourceVersion || ''),
    latestPlannerVersion: String(session.latestPlannerVersion || ''),
    matches: {},
    temporaryVisits: {},
    ignored: {},
    keeps: {},
    deletions: {},
    counts: {
      match: 0,
      temporary: 0,
      ignore: 0,
      keep: 0,
      delete: 0
    }
  };

  Object.keys(decisions).forEach(function (key) {
    const record = decisions[key] || {};
    const reviewType = String(record.reviewType || '').trim().toUpperCase();
    const itemKey = String(record.itemKey || '').trim();
    const decision = String(record.decision || '').trim().toUpperCase();
    if (!reviewType || !itemKey || !decision) return;

    if (reviewType === 'SUGGESTED_MATCH') {
      if (decision === 'MATCH') {
        result.matches[itemKey] = true;
        result.counts.match++;
      } else if (decision === 'IGNORE') {
        result.ignored[itemKey] = true;
        result.counts.ignore++;
      }
      return;
    }

    if (reviewType === 'UNCLASSIFIED_EVENT') {
      if (decision === 'TEMPORARY') {
        result.temporaryVisits[itemKey] = true;
        result.counts.temporary++;
      } else if (decision === 'IGNORE') {
        result.ignored[itemKey] = true;
        result.counts.ignore++;
      }
      return;
    }

    if (reviewType === 'DELETION_CANDIDATE') {
      if (decision === 'KEEP') {
        result.keeps[itemKey] = true;
        result.counts.keep++;
      } else if (decision === 'DELETE') {
        result.deletions[itemKey] = true;
        result.counts.delete++;
      }
    }
  });

  return Object.freeze(result);
}

function hasPmosCalendarReviewDecision_(decisionSet, category, itemKey) {
  const collection = decisionSet && decisionSet[category];
  return Boolean(collection && collection[String(itemKey || '').trim()]);
}

function summarizePmosCalendarReviewDecisions_() {
  const decisions = readActivePmosCalendarReviewDecisions_();
  return {
    sessionId: decisions.sessionId,
    matched: decisions.counts.match,
    temporaryVisits: decisions.counts.temporary,
    ignored: decisions.counts.ignore,
    kept: decisions.counts.keep,
    approvedDeletions: decisions.counts.delete
  };
}

/**
 * Converts the normalized Review Session into immutable operation intents.
 *
 * These are not executable Calendar operations yet. The planner resolves each
 * stable item key against verified Calendar state before creating a write.
 */
function buildPmosCalendarReviewOperationIntents_(decisionSet) {
  const decisions = decisionSet || readActivePmosCalendarReviewDecisions_();
  const intents = [];

  appendPmosCalendarReviewIntents_(intents, decisions.matches, 'LINK_CUSTOMER');
  appendPmosCalendarReviewIntents_(intents, decisions.temporaryVisits, 'REGISTER_TEMPORARY_VISIT');
  appendPmosCalendarReviewIntents_(intents, decisions.keeps, 'PRESERVE_EVENT');
  appendPmosCalendarReviewIntents_(intents, decisions.deletions, 'DELETE_APPROVED_EVENT');

  return Object.freeze(intents.map(function (intent) {
    return Object.freeze(intent);
  }));
}

function appendPmosCalendarReviewIntents_(target, collection, action) {
  Object.keys(collection || {}).sort().forEach(function (itemKey) {
    target.push({
      id: 'REVIEW_' + action + '_' + pmosCalendarHash_(String(itemKey)),
      action: action,
      itemKey: String(itemKey),
      approvedByUser: true
    });
  });
}

/**
 * Verifies the decision set before it is attached to a Calendar Sync plan.
 * Ignored events are deliberately omitted because they must have received a
 * later TEMPORARY, KEEP, or DELETE disposition before synchronization.
 */
function validatePmosCalendarReviewDecisionSet_(decisionSet) {
  const decisions = decisionSet || readActivePmosCalendarReviewDecisions_();
  const intents = buildPmosCalendarReviewOperationIntents_(decisions);
  const seen = {};
  const errors = [];

  intents.forEach(function (intent) {
    const key = String(intent.itemKey || '');
    if (!key) {
      errors.push('A review decision is missing its stable Calendar identity.');
      return;
    }
    if (seen[key]) {
      errors.push('Calendar item ' + key + ' has more than one final review disposition.');
      return;
    }
    seen[key] = intent.action;
  });

  return Object.freeze({
    valid: errors.length === 0,
    errorCount: errors.length,
    errors: Object.freeze(errors.slice()),
    intentCount: intents.length,
    sessionId: String(decisions.sessionId || '')
  });
}
