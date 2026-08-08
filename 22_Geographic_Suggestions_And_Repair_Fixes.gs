/**
 * Geography-first maintenance placement helpers.
 *
 * Calendar Repair fixes formerly appended to this module have been moved to
 * their authoritative Repair modules so loading order no longer determines
 * Repair behavior.
 */

function maintenanceGeocodeAddress_(address) {
  const text = String(address || '').trim();
  if (!text) return null;

  const cache = CacheService.getDocumentCache();
  const key = 'PMOS_GEO_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      text.toLowerCase()
    )
  ).slice(0, 40);
  const cached = cache.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {}
  }

  try {
    const response = Maps.newGeocoder().setRegion('ca').geocode(text);
    const result = response && response.results && response.results[0];
    const location = result && result.geometry && result.geometry.location;
    if (!location) return null;

    const point = {
      lat: Number(location.lat),
      lng: Number(location.lng)
    };
    cache.put(key, JSON.stringify(point), 21600);
    return point;
  } catch (error) {
    return null;
  }
}

function maintenanceDistanceKm_(a, b) {
  if (!a || !b) return null;

  const radians = function(value) {
    return Number(value) * Math.PI / 180;
  };
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function maintenanceRotationGeography_(table, day, candidateWeeks, targetPoint) {
  const layerIndex = findHeaderIndex_(table.headers, [
    'Layer', 'Route Layer', 'Route Assignment'
  ]);
  const addressIndex = findHeaderIndex_(table.headers, [
    'Address', 'Service Address', 'Street Address'
  ]);
  const distances = [];
  let stops = 0;

  table.rows.forEach(function(row) {
    const layer = String(layerIndex >= 0 ? row[layerIndex] || '' : '');
    const match = layer.match(/week\s*(\d)/i);
    if (
      !match ||
      candidateWeeks.indexOf(Number(match[1])) < 0 ||
      layer.toLowerCase().indexOf(day.toLowerCase()) < 0
    ) {
      return;
    }

    stops++;
    if (!targetPoint || addressIndex < 0) return;
    const point = maintenanceGeocodeAddress_(row[addressIndex]);
    const distance = maintenanceDistanceKm_(targetPoint, point);
    if (distance != null && Number.isFinite(distance)) {
      distances.push(distance);
    }
  });

  distances.sort(function(a, b) { return a - b; });
  const nearest = distances.length ? distances[0] : null;
  const nearby = distances.filter(function(value) { return value <= 8; }).length;
  const median = distances.length
    ? distances[Math.floor(distances.length / 2)]
    : null;

  return {
    weeks:candidateWeeks.slice(),
    stops:stops,
    nearest:nearest,
    nearby:nearby,
    median:median,
    geocoded:distances.length
  };
}

function compareMaintenanceGeography_(a, b) {
  const aHas = a.nearest != null;
  const bHas = b.nearest != null;
  if (aHas !== bHas) return aHas ? -1 : 1;

  if (aHas && bHas) {
    if (a.nearby !== b.nearby) return b.nearby - a.nearby;
    if (Math.abs(a.nearest - b.nearest) > 0.75) {
      return a.nearest - b.nearest;
    }
    if (
      a.median != null &&
      b.median != null &&
      Math.abs(a.median - b.median) > 1.5
    ) {
      return a.median - b.median;
    }
  }

  return a.stops - b.stops || a.weeks[0] - b.weeks[0];
}

function suggestMaintenanceClientPlacement(input) {
  input = input || {};
  const frequency = normalizeMaintenanceFrequency_(input.frequency);
  const day = normalizeMaintenanceDay_(input.day);

  if (frequency === 'Weekly' || frequency === 'Twice Weekly') {
    return {
      week:1,
      summary: frequency === 'Twice Weekly'
        ? 'Twice-weekly service uses both selected weekdays in every rotation week, so no rotation choice is required.'
        : 'Weekly service uses every rotation week, so no rotation choice is required.'
    };
  }

  const address = String(input.address || '').trim();
  if (!address) {
    throw new Error(
      'Enter the service address before requesting a geographic suggestion.'
    );
  }

  const spreadsheet = SpreadsheetApp.getActive();
  const routeSheet = findFirstSheetByName_(spreadsheet, [
    '4-Week Route Template',
    'PMOS 4-Week Route Template',
    'Route Template'
  ]);
  if (!routeSheet) {
    throw new Error('4-Week Route Template sheet was not found.');
  }

  const table = readHeaderTable_(routeSheet);
  const targetPoint = maintenanceGeocodeAddress_(address);
  const candidates = frequency === 'Biweekly'
    ? [[1,3], [2,4]]
    : [[1], [2], [3], [4]];
  const scored = candidates.map(function(weeks) {
    return maintenanceRotationGeography_(table, day, weeks, targetPoint);
  });
  scored.sort(compareMaintenanceGeography_);

  const best = scored[0];
  const geographyText = best.nearest != null
    ? 'Nearest existing ' + day + ' stop is approximately ' +
      best.nearest.toFixed(1) + ' km away; ' + best.nearby +
      ' existing stop(s) are within about 8 km.'
    : 'PMOS could not geocode enough route addresses, so stop count was used as the fallback.';
  const rotationText = best.weeks.length === 2
    ? 'Weeks ' + best.weeks[0] + ' and ' + best.weeks[1]
    : 'Week ' + best.weeks[0];

  return {
    week:best.weeks[0],
    summary:[
      'Suggested ' + day + ' rotation: ' + rotationText + '.',
      geographyText,
      'Current stop count in that rotation: ' + best.stops + '.',
      'Geographic proximity is ranked before stop-count balance.'
    ].join('\n')
  };
}
