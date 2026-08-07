/**
 * Reloads the exact Calendar object represented by a reviewed snapshot record.
 * Calendar#getEventById is attempted first. A narrow snapshot fallback handles
 * Google Calendar IDs that are returned by getEvents() but are not reloadable
 * through getEventById() on the same Calendar.
 */
function resolveReviewedCalendarTarget_(calendar, identity) {
  const source = identity || {};
  const eventId = String(source.eventId || '').trim();
  const seriesId = String(source.seriesId || '').trim();

  if (seriesId) {
    try {
      const series = calendar.getEventSeriesById(seriesId);
      if (series) return {kind: 'SERIES', object: series, resolution: 'SERIES_ID'};
    } catch (error) {}
  }

  if (eventId) {
    try {
      const event = calendar.getEventById(eventId);
      if (event) return reviewedCalendarResolvedEvent_(event, 'EVENT_ID');
    } catch (error) {}
  }

  const start = parseReviewedCalendarTargetDate_(source.start);
  if (!start) return {kind: '', object: null, resolution: ''};

  const windowStart = new Date(start.getTime() - 12 * 60 * 60 * 1000);
  const windowEnd = new Date(start.getTime() + 36 * 60 * 60 * 1000);
  let candidates = [];
  try { candidates = calendar.getEvents(windowStart, windowEnd); }
  catch (error) { return {kind: '', object: null, resolution: ''}; }

  const exactId = candidates.filter(function (event) {
    return eventId && reviewedCalendarIdsEqual_(event.getId(), eventId);
  });
  if (exactId.length === 1) return reviewedCalendarResolvedEvent_(exactId[0], 'RANGE_EVENT_ID');

  const exactSnapshot = candidates.filter(function (event) {
    return reviewedCalendarSnapshotMatches_(event, source);
  });
  if (exactSnapshot.length === 1) {
    return reviewedCalendarResolvedEvent_(exactSnapshot[0], 'RANGE_SNAPSHOT');
  }

  return {kind: '', object: null, resolution: ''};
}

function reviewedCalendarResolvedEvent_(event, resolution) {
  try {
    if (event.isRecurringEvent()) {
      const series = event.getEventSeries();
      if (series) return {kind: 'SERIES', object: series, event: event, resolution: resolution};
    }
  } catch (error) {}
  return {kind: 'EVENT', object: event, event: event, resolution: resolution};
}

function reviewedCalendarSnapshotMatches_(event, expected) {
  const source = expected || {};
  const expectedStart = parseReviewedCalendarTargetDate_(source.start);
  if (!expectedStart) return false;
  const actualStart = event.getStartTime();
  if (Math.abs(actualStart.getTime() - expectedStart.getTime()) > 1000) return false;

  const expectedEnd = parseReviewedCalendarTargetDate_(source.end);
  if (expectedEnd && Math.abs(event.getEndTime().getTime() - expectedEnd.getTime()) > 1000) return false;

  const title = String(source.title || '').trim();
  if (title && String(event.getTitle() || '').trim() !== title) return false;

  const location = String(source.location || '').trim();
  if (location && String(event.getLocation() || '').trim() !== location) return false;

  return true;
}

function reviewedCalendarIdsEqual_(left, right) {
  const a = normalizeReviewedCalendarId_(left);
  const b = normalizeReviewedCalendarId_(right);
  return Boolean(a && b && a === b);
}

function normalizeReviewedCalendarId_(value) {
  return String(value || '').trim().replace(/@google\.com$/i, '');
}

function parseReviewedCalendarTargetDate_(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
