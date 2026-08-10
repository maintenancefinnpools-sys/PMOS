/** Deletes only the exact Calendar event or series explicitly approved in review. */
function executeReviewedCalendarDeleteOperation_(operation, calendar) {
  const payload = operation && operation.payload || {};
  const current = payload.current || {};
  const review = payload.review || {};
  const entityId = String(operation && operation.entityId || '').trim();
  const reviewedSeriesKey = String(review.seriesKey || '').trim();
  const reviewedSeriesId = String(review.seriesId || '').trim();
  const reviewedEventId = String(review.eventId || '').trim();
  const currentSeriesKey = String(current.seriesKey || '').trim();
  const currentSeriesId = String(current.seriesId || current.id || '').trim();
  const currentEventId = String(current.eventId || '').trim();

  const seriesKey = reviewedSeriesKey || currentSeriesKey;
  const seriesId = reviewedSeriesId || currentSeriesId;
  const eventId = reviewedEventId || currentEventId;

  if (!seriesId && !eventId) {
    throw new Error('Reviewed DELETE operation is missing an exact Calendar event or series ID.');
  }

  const approvedKeys = [seriesKey, seriesId, eventId].filter(Boolean);
  if (entityId && approvedKeys.indexOf(entityId) < 0) {
    throw new Error(
      'Reviewed DELETE identity mismatch. The queued entity does not match the event approved during review.'
    );
  }

  if (seriesId) {
    let series = null;
    try { series = calendar.getEventSeriesById(seriesId); } catch (error) {}

    // A retry may arrive after the first delete succeeded. Only invoke the
    // mutation when Calendar still returns a series handle.
    if (series) {
      try {
        series.deleteEventSeries();
      } catch (error) {
        // Calendar can retain a stale series handle briefly after deletion.
        // Verify live occurrences below before deciding that the retry failed.
      }
    }

    if (!waitForReviewedCalendarSeriesDeletion_(calendar, seriesId)) {
      throw new Error('Reviewed series deletion could not be verified: ' + seriesId + '.');
    }

    if (seriesKey) deleteReviewedSeriesRegistryRowExact_(seriesKey, seriesId);
    return {action: 'DELETE', id: seriesId, reviewAction: 'DELETE'};
  }

  let event = null;
  try { event = calendar.getEventById(eventId); } catch (error) {}
  if (event) {
    if (event.isRecurringEvent()) {
      throw new Error(
        'Reviewed DELETE targeted one event ID that now belongs to a recurring series. PMOS stopped before deleting the series.'
      );
    }
    event.deleteEvent();
  }

  let remainingEvent = null;
  try { remainingEvent = calendar.getEventById(eventId); } catch (error) {}
  if (remainingEvent) {
    throw new Error('Reviewed event deletion could not be verified: ' + eventId + '.');
  }

  return {action: 'DELETE', id: eventId, reviewAction: 'DELETE'};
}

/**
 * CalendarApp may return a stale CalendarEventSeries immediately after
 * deleteEventSeries(). Verify the observable schedule instead: the deletion is
 * complete when no occurrence with the approved series ID remains in the
 * active planning window.
 */
function waitForReviewedCalendarSeriesDeletion_(calendar, seriesId) {
  const id = String(seriesId || '').trim();
  if (!calendar || !id) return true;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (!reviewedCalendarSeriesHasActiveOccurrence_(calendar, id)) return true;
    if (attempt < 3) Utilities.sleep(1000);
  }
  return false;
}

function reviewedCalendarSeriesHasActiveOccurrence_(calendar, seriesId) {
  const settings = getRecurringCalendarSettings_();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const configuredEnd = endOfDay_(settings.seasonEnd);
  const end = configuredEnd.getTime() > start.getTime()
    ? configuredEnd
    : new Date(start.getTime() + 35 * 24 * 60 * 60 * 1000);

  return calendar.getEvents(start, end).some(function(event) {
    let recurring = false;
    try { recurring = event.isRecurringEvent(); } catch (error) {}
    if (!recurring) return false;
    return String(readPmosCalendarEventSeriesId_(event) || '').trim() === seriesId;
  });
}

function deleteReviewedSeriesRegistryRowExact_(seriesKey, seriesId) {
  const key = String(seriesKey || '').trim();
  const id = String(seriesId || '').trim();
  if (!key || !id) return;

  const sheet = ensureRecurringSeriesRegistry_();
  const values = sheet.getDataRange().getValues();
  for (let index = values.length - 1; index >= 1; index--) {
    const rowKey = String(values[index][0] || '').trim();
    const rowSeriesId = String(values[index][3] || '').trim();
    if (rowKey === key && rowSeriesId === id) {
      sheet.deleteRow(index + 1);
    }
  }
}
