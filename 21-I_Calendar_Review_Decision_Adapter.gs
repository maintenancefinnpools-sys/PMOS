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
