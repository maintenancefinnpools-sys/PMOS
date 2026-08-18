/**
 * PMOS v1.9.0 — Temporary visit recommendation engine.
 * Move-only refactor: public names and operational behavior are preserved.
 */

function recommendTemporaryVisitDates_(payload) {
  payload = payload || {};
  const target = getVerifiedTemporaryVisitPoint_(payload);


  // The initial search covers six business days so it includes the same
  // weekday next week. Every expansion adds another six business days.
  const startOffset = Math.max(0, Math.floor(Number(payload.startOffsetWorkingDays || 0)));
  const workdayCount = Math.max(1, Math.min(18, Math.floor(Number(payload.workdayCount || 6))));
  const maxResults = Math.max(1, Math.min(10, Number(payload.maxResults || 3)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const calendar = getRecurringCalendar_();
  const geocoder = Maps.newGeocoder();
  const candidateDates = [];


  let skippedWorkdays = 0;
  let collectedWorkdays = 0;
  let cursor = new Date(today);
  while (collectedWorkdays < workdayCount) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      if (skippedWorkdays < startOffset) {
        skippedWorkdays++;
      } else {
        candidateDates.push(new Date(cursor));
        collectedWorkdays++;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }


  // Fast layer: load a lightweight route snapshot and rank candidate dates by
  // distance to the route centroid. This is safer than city-name matching and
  // works across municipal boundaries and rural addresses.
  const staged = candidateDates.map(date => {
    const snapshot = getTemporaryRouteSnapshot_(calendar, geocoder, date);
    const centroidDistanceKm = snapshot && snapshot.centroid
      ? pmosHaversineKm_(target, snapshot.centroid)
      : Number.POSITIVE_INFINITY;
    return {date, snapshot, centroidDistanceKm};
  }).filter(item => item.snapshot && item.snapshot.events.length);


  staged.sort((a, b) => {
    if (a.centroidDistanceKm !== b.centroidDistanceKm) return a.centroidDistanceKm - b.centroidDistanceKm;
    return a.date - b.date;
  });


  // Smart layer: perform exact insertion analysis. The snapshots and geocodes
  // are cached, so later expansions and nearby-date checks avoid repeating work.
  const recommendations = staged.map(item =>
    calculateTemporaryPlacementForDate_(calendar, geocoder, target, item.date, 1, item.snapshot)
  ).filter(Boolean);


  recommendations.sort(compareTemporaryVisitRecommendations_);
  return {
    recommendations: recommendations.slice(0, maxResults),
    startOffsetWorkingDays: startOffset,
    workdayCount,
    nextOffsetWorkingDays: startOffset + workdayCount,
    qualityMessage: temporaryRecommendationQualityMessage_(recommendations.slice(0, maxResults))
  };
}

function temporaryRecommendationQualityMessage_(recommendations) {
  if (!recommendations || !recommendations.length) return 'No scheduled weekday routes were available in this window.';
  const bestScore = Number(recommendations[0].score || 0);
  if (bestScore >= 90) return 'Excellent opportunities found nearby.';
  if (bestScore >= 78) return 'Good scheduling opportunities found.';
  return 'No excellent opportunities were found in this six-business-day window. Consider searching six more business days.';
}

function compareTemporaryVisitRecommendations_(a, b) {
  if (Number(a.score || 0) !== Number(b.score || 0)) return Number(b.score || 0) - Number(a.score || 0);
  if (a.addedDistanceKm !== b.addedDistanceKm) return a.addedDistanceKm - b.addedDistanceKm;
  if (a.customerCount !== b.customerCount) return a.customerCount - b.customerCount;
  return a.date.localeCompare(b.date);
}

function calculateTemporaryPlacementForDate_(calendar, geocoder, target, serviceDate, fallbackPosition, suppliedSnapshot) {
  const snapshot = suppliedSnapshot || getTemporaryRouteSnapshot_(calendar, geocoder, serviceDate);
  if (!snapshot || !snapshot.events.length || snapshot.points.filter(Boolean).length < 1) return null;


  const events = snapshot.events;
  const points = snapshot.points;
  let bestPosition = Math.max(1, Number(fallbackPosition || 1));
  let bestAddedDistance = Number.POSITIVE_INFINITY;
  for (let position = 0; position <= events.length; position++) {
    const previous = position > 0 ? points[position - 1] : null;
    const next = position < points.length ? points[position] : null;
    let added = 0;
    if (previous) added += pmosHaversineKm_(previous, target);
    if (next) added += pmosHaversineKm_(target, next);
    if (previous && next) added -= pmosHaversineKm_(previous, next);
    if (added < bestAddedDistance) { bestAddedDistance = added; bestPosition = position + 1; }
  }


  let roadResult = null;
  let roadError = '';
  const validRoute = [];
  const validTitles = [];
  points.forEach(function (point, index) {
    if (!point) return;
    validRoute.push(point);
    validTitles.push(events[index] ? events[index].title : '');
  });
  try {
    const uniquePoints = [];
    const pointIndexes = {};
    [target].concat(validRoute).forEach(function (point) {
      const normalized = normalizePmosRiePoint_(point);
      const key = normalized.lat.toFixed(6) + ',' + normalized.lng.toFixed(6);
      if (pointIndexes[key] == null) {
        pointIndexes[key] = uniquePoints.length;
        uniquePoints.push(normalized);
      }
    });
    if (uniquePoints.length > 1) {
      const matrix = matrixPmosWithRie_(uniquePoints);
      roadResult = choosePmosMatrixInsertion_({
        routePoints: validRoute,
        routeTitles: validTitles
      }, target, matrix, pointIndexes);
      if (roadResult) {
        bestPosition = roadResult.position;
        roadResult.providerLabel = matrix.providerLabel || 'GraphHopper';
      }
    }
  } catch (error) {
    roadError = String(error && error.message || error);
  }

  if (!roadResult) {
    try {
      roadResult = calculateTemporaryDirectionsInsertion_(
        validRoute,
        validTitles,
        target,
        bestPosition
      );
    } catch (error) {
      roadError = [roadError, String(error && error.message || error)].filter(Boolean).join(' | ');
    }
  }

  if (roadResult) bestAddedDistance = roadResult.addedDistanceKm;
  const centroidDistanceKm = snapshot.centroid ? pmosHaversineKm_(target, snapshot.centroid) : bestAddedDistance;
  // Use a deliberately forgiving absolute score. Date-search results are
  // labelled comparatively in the browser after all results found so far are
  // ranked. This absolute label is mainly used for a manually selected date.
  const routeScaleKm = Math.max(12, Math.min(80, events.length * 4));
  const detourRatio = bestAddedDistance / routeScaleKm;
  const distanceScore = Math.max(0, 100 - Math.min(70, detourRatio * 100));
  const continuityScore = Math.max(0, 100 - Math.min(45, centroidDistanceKm * 1.6));
  const loadPenalty = Math.max(0, events.length - 15) * 0.8;
  const score = roadResult
    ? Math.max(0, Math.min(100, Math.round(100 - Math.min(80, roadResult.addedDurationMinutes * 3.5) - loadPenalty)))
    : Math.max(0, Math.min(100, Math.round(distanceScore * 0.68 + continuityScore * 0.32 - loadPenalty)));


  let rating = 'Excellent', ratingClass = 'good', reason = 'Fits naturally into the actual route scheduled for this date.';
  const ratingMetric = roadResult ? roadResult.addedDurationMinutes : bestAddedDistance;
  if (ratingMetric <= 5) {
    rating = 'Excellent'; ratingClass = 'good'; reason = 'Adds very little travel to the scheduled route.';
  } else if (ratingMetric <= 10) {
    rating = 'Very Good'; ratingClass = 'good'; reason = 'A practical insertion with only a modest detour.';
  } else if (ratingMetric <= 18) {
    rating = 'Good'; ratingClass = 'fair'; reason = 'Adds some travel but remains a reasonable route option.';
  } else if (ratingMetric <= 30) {
    rating = 'Fair'; ratingClass = 'fair'; reason = 'A longer detour, but potentially worthwhile depending on customer availability.';
  } else {
    rating = 'Last Resort'; ratingClass = 'poor'; reason = 'This is the best insertion found for the selected date, but it adds substantial travel.';
  }


  const settings = getRecurringCalendarSettings_();
  const rotationWeek = pmosRotationWeekForDate_(serviceDate, settings.rotationWeek1Start);
  return {
    date: Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'yyyy-MM-dd'),
    displayDate: Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'EEE MMM d, yyyy'),
    dayName: Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'EEEE'),
    rotationWeek,
    customerCount: events.length,
    position: bestPosition,
    previousName: roadResult ? roadResult.previousName : (bestPosition > 1 ? events[bestPosition - 2].title : ''),
    nextName: roadResult ? roadResult.nextName : (bestPosition <= events.length ? events[bestPosition - 1].title : ''),
    addedDistanceKm: bestAddedDistance,
    addedDurationMinutes: roadResult ? roadResult.addedDurationMinutes : null,
    routeDistanceKm: roadResult ? roadResult.routeDistanceKm : null,
    routeDriveMinutes: roadResult ? roadResult.routeDurationMinutes : null,
    estimatedRouteMinutes: roadResult ? roadResult.routeDurationMinutes + (events.length + 1) * getPmosRieSettings_().serviceMinutes : null,
    routeProvider: roadResult ? roadResult.providerLabel : '',
    roadDataComplete: !!roadResult,
    roadDataMessage: roadResult ? '' : roadError,
    centroidDistanceKm,
    score,
    rating,
    ratingClass,
    reason
  };
}

function calculateTemporaryDirectionsInsertion_(route, titles, target, preferredPosition) {
  const routePoints = (route || []).filter(Boolean);
  if (!routePoints.length) return null;
  const position = Math.max(1, Math.min(routePoints.length + 1, Number(preferredPosition || 1)));
  const previous = position > 1 ? routePoints[position - 2] : null;
  const next = position <= routePoints.length ? routePoints[position - 1] : null;
  const impact = pmosDrivingInsertionImpact_(previous, target, next);
  const inserted = routePoints.slice();
  inserted.splice(position - 1, 0, target);
  const fullRoute = inserted.length >= 2 ? pmosDrivingRouteMetric_(inserted) : null;
  if (!impact || !fullRoute) return null;
  return {
    position: position,
    previousName: position > 1 ? String((titles || [])[position - 2] || '') : '',
    nextName: position <= routePoints.length ? String((titles || [])[position - 1] || '') : '',
    addedDistanceKm: impact.addedDistanceKm,
    addedDurationMinutes: impact.addedDurationMinutes,
    routeDistanceKm: fullRoute.distanceKm,
    routeDurationMinutes: fullRoute.durationMinutes,
    providerLabel: fullRoute.providerLabel || impact.providerLabel || 'GPS routing provider'
  };
}

function getTemporaryRouteSnapshot_(calendar, geocoder, serviceDate) {
  const dateKey = Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'yyyyMMdd');
  const cache = CacheService.getScriptCache();
  const cacheKey = `PMOS_ROUTE_${dateKey}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (ignored) {}
  }


  const dayStart = new Date(serviceDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(serviceDate); dayEnd.setHours(23, 59, 59, 999);
  const calendarEvents = calendar.getEvents(dayStart, dayEnd)
    .filter(event => !event.isAllDayEvent())
    .sort((a, b) => a.getStartTime() - b.getStartTime());


  const events = calendarEvents.map(event => ({
    title: event.getTitle(),
    location: String(event.getLocation() || '').trim(),
    start: event.getStartTime().getTime()
  }));
  const points = events.map(event => event.location ? geocodePmosAddress_(geocoder, event.location, true) : null);
  const validPoints = points.filter(Boolean);
  const centroid = validPoints.length ? {
    lat: validPoints.reduce((sum, point) => sum + point.lat, 0) / validPoints.length,
    lng: validPoints.reduce((sum, point) => sum + point.lng, 0) / validPoints.length
  } : null;
  const snapshot = {events, points, centroid};
  try { cache.put(cacheKey, JSON.stringify(snapshot), 900); } catch (ignored) {}
  return snapshot;
}

function invalidateTemporaryRouteSnapshot_(serviceDate) {
  const dateKey = Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'yyyyMMdd');
  CacheService.getScriptCache().remove(`PMOS_ROUTE_${dateKey}`);
}

function pmosRotationWeekForDate_(date, week1Monday) {
  const target = new Date(date); target.setHours(0,0,0,0);
  const anchor = new Date(week1Monday); anchor.setHours(0,0,0,0);
  const days = Math.floor((target.getTime() - anchor.getTime()) / 86400000);
  const weeks = Math.floor(days / 7);
  return ((weeks % 4) + 4) % 4 + 1;
}

function suggestTemporaryVisitPlacement_(payload) {
  payload = payload || {};
  const dates = Array.isArray(payload.dates) ? payload.dates.filter(Boolean) : (payload.date ? [payload.date] : []);
  if (!dates.length) throw new Error('Choose at least one visit date.');


  const serviceDate = parseTemporaryVisitDate_(dates[0]);
  const calendar = getRecurringCalendar_();
  const geocoder = Maps.newGeocoder();
  const target = getVerifiedTemporaryVisitPoint_(payload);
  let selected = calculateTemporaryPlacementForDate_(
    calendar,
    geocoder,
    target,
    serviceDate,
    Number(payload.stopPosition || 1)
  );


  if (!selected) {
    const dayName = Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'EEEE');
    selected = {
      date: Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'yyyy-MM-dd'),
      displayDate: Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'EEE MMM d, yyyy'),
      dayName,
      customerCount: 0,
      position: 1,
      previousName: '',
      nextName: '',
      addedDistanceKm: 0,
      rating: 'Excellent',
      ratingClass: 'good',
      reason: 'There are no other timed visits on this date.'
    };
  }


  // Once the user chooses a date, that date is authoritative. Only stop
  // placement is recalculated; alternate dates belong in the date search.
  selected.nearbyAlternatives = [];
  selected.selectedDateIsBest = true;
  return selected;
}

function getVerifiedTemporaryVisitPoint_(payload) {
  payload = payload || {};
  const address = String(payload.address || '').trim();
  const details = payload.addressDetails || {};
  if (!address) throw new Error('Enter the temporary customer address.');
  if (!payload.addressVerified || !details.address) {
    throw new Error('Choose a complete address from the suggestions before calculating a route.');
  }
  if (String(details.address).trim().toLowerCase() !== address.toLowerCase()) {
    throw new Error('The service address changed. Choose it from the suggestions again.');
  }
  return normalizePmosRiePoint_({lat: details.lat, lng: details.lng});
}

function geocodePmosAddress_(geocoder, address, allowFailure) {
  try {
    const normalizedAddress = String(address || '').trim();
    const cache = CacheService.getScriptCache();
    const digest = Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, normalizedAddress.toLowerCase())
    ).replace(/=+$/, '');
    const cacheKey = `PMOS_GEO_${digest}`;
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);


    const response = geocoder.geocode(normalizedAddress);
    const result = response &&
      response.results &&
      response.results[0];


    if (!result) {
      if (allowFailure) return null;
      throw new Error(`Address could not be located: ${address}`);
    }


    const location = result.geometry.location;
    const point = {
      lat: Number(location.lat),
      lng: Number(location.lng)
    };
    cache.put(cacheKey, JSON.stringify(point), 21600);
    return point;
  } catch (error) {
    if (allowFailure) return null;
    throw error;
  }
}

function pmosHaversineKm_(a, b) {
  const toRadians = degrees => degrees * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);


  const value =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);


  return 2 * earthRadiusKm * Math.asin(Math.sqrt(value));
}
