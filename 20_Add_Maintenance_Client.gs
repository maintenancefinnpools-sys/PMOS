/**
 * Maintenance-customer route recommendations and shared transaction helpers.
 *
 * UI ownership lives in 20-C and the authoritative spreadsheet transaction
 * lives in 20-E. This module never creates customers or mutates Calendar.
 */
function showAddMaintenanceClient() {
  return showAddMaintenanceClientV2();
}

function recommendMaintenanceClientRotations(input) {
  input = input || {};
  const address = String(input.address || '').trim();
  if (!address) throw new Error('Enter the service address.');
  const frequency = normalizeMaintenanceFrequency_(input.frequency || 'Weekly');
  const geocoder = Maps.newGeocoder().setRegion('ca');
  const target = geocodePmosAddress_(geocoder, address);
  const routes = readRoutesInPhysicalOrder_();
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const candidates = [];

  if (frequency === 'Weekly') {
    days.forEach(function (day) { candidates.push({day: day, weeks: [1, 2, 3, 4]}); });
  } else if (frequency === 'Biweekly') {
    days.forEach(function (day) {
      candidates.push({day: day, weeks: [1, 3]});
      candidates.push({day: day, weeks: [2, 4]});
    });
  } else if (frequency === 'Monthly') {
    days.forEach(function (day) {
      [1, 2, 3, 4].forEach(function (week) {
        candidates.push({day: day, weeks: [week]});
      });
    });
  } else {
    for (let first = 0; first < days.length; first++) {
      for (let second = first + 1; second < days.length; second++) {
        candidates.push({
          day: days[first],
          secondDay: days[second],
          weeks: [1, 2, 3, 4]
        });
      }
    }
  }

  const scored = candidates
    .map(function (candidate) {
      return scoreMaintenanceRotationCandidate_(routes, geocoder, target, candidate);
    })
    .filter(Boolean);
  scored.sort(function (a, b) {
    return b.score - a.score ||
      a.addedDistanceKm - b.addedDistanceKm ||
      a.customerCount - b.customerCount ||
      a.day.localeCompare(b.day);
  });

  const recommendations = scored.slice(0, 3).map(function (item) {
    item.label = item.secondDay ? item.day + ' + ' + item.secondDay : item.day;
    item.rotationLabel = item.weeks.length === 4
      ? 'Every rotation week'
      : item.weeks.length === 2
        ? 'Weeks ' + item.weeks[0] + ' & ' + item.weeks[1]
        : 'Week ' + item.weeks[0];
    item.week = item.weeks[0];
    item.rating = item.score >= 90 ? 'Excellent' :
      item.score >= 80 ? 'Very Good' :
      item.score >= 70 ? 'Good' :
      item.score >= 55 ? 'Fair' : 'Last Resort';
    item.reason = item.addedDistanceKm <= 3
      ? 'Adds very little travel to the current route structure.'
      : item.addedDistanceKm <= 8
        ? 'A practical route fit with only a modest detour.'
        : item.addedDistanceKm <= 15
          ? 'Adds some travel but remains a reasonable placement.'
          : 'This is one of the best available placements, but it adds substantial travel.';
    return item;
  });

  return {
    recommendations: recommendations,
    qualityMessage: recommendations.length
      ? 'Best ' + frequency.toLowerCase() + ' placements based primarily on geographic route fit.'
      : 'No usable route placements were found. Manual placement remains available.'
  };
}

function scoreMaintenanceRotationCandidate_(routes, geocoder, target, candidate) {
  const serviceDays = candidate.secondDay
    ? [candidate.day, candidate.secondDay]
    : [candidate.day];
  const placements = [];
  candidate.weeks.forEach(function (week) {
    serviceDays.forEach(function (day) {
      placements.push(
        maintenanceLayerInsertion_(routes, geocoder, target, 'Week ' + week + ' - ' + day)
      );
    });
  });
  if (!placements.length) return null;

  const averageAdded = placements.reduce(function (sum, placement) {
    return sum + placement.addedDistanceKm;
  }, 0) / placements.length;
  const averageCentroid = placements.reduce(function (sum, placement) {
    return sum + placement.centroidDistanceKm;
  }, 0) / placements.length;
  const averageCount = placements.reduce(function (sum, placement) {
    return sum + placement.customerCount;
  }, 0) / placements.length;
  const routeScale = Math.max(12, Math.min(80, averageCount * 4));
  const distanceScore = Math.max(0, 100 - Math.min(75, (averageAdded / routeScale) * 100));
  const continuityScore = Math.max(0, 100 - Math.min(50, averageCentroid * 1.6));
  const loadPenalty = Math.max(0, averageCount - 15) * 0.7;
  const primary = placements[0];

  return {
    day: candidate.day,
    secondDay: candidate.secondDay || '',
    weeks: candidate.weeks.slice(),
    position: primary.position,
    previousName: primary.previousName,
    nextName: primary.nextName,
    addedDistanceKm: averageAdded,
    centroidDistanceKm: averageCentroid,
    customerCount: averageCount,
    score: Math.max(
      0,
      Math.min(100, Math.round(distanceScore * 0.7 + continuityScore * 0.3 - loadPenalty))
    )
  };
}

function maintenanceLayerInsertion_(routes, geocoder, target, layerName) {
  const rows = routes
    .filter(function (row) { return normalize_(row.layer) === normalize_(layerName); })
    .sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
  const points = rows.map(function (row) {
    return row.address ? geocodePmosAddress_(geocoder, row.address, true) : null;
  });
  const valid = points.filter(Boolean);
  if (!rows.length || !valid.length) {
    return {
      position: 1,
      previousName: '',
      nextName: '',
      addedDistanceKm: 0,
      centroidDistanceKm: 0,
      customerCount: rows.length
    };
  }

  let bestPosition = 1;
  let bestAdded = Number.POSITIVE_INFINITY;
  for (let position = 0; position <= rows.length; position++) {
    const previous = position > 0 ? points[position - 1] : null;
    const next = position < points.length ? points[position] : null;
    let added = 0;
    if (previous) added += pmosHaversineKm_(previous, target);
    if (next) added += pmosHaversineKm_(target, next);
    if (previous && next) added -= pmosHaversineKm_(previous, next);
    if (added < bestAdded) {
      bestAdded = added;
      bestPosition = position + 1;
    }
  }

  const centroid = {
    lat: valid.reduce(function (sum, point) { return sum + point.lat; }, 0) / valid.length,
    lng: valid.reduce(function (sum, point) { return sum + point.lng; }, 0) / valid.length
  };
  return {
    position: bestPosition,
    previousName: bestPosition > 1 ? String(rows[bestPosition - 2].title || '') : '',
    nextName: bestPosition <= rows.length ? String(rows[bestPosition - 1].title || '') : '',
    addedDistanceKm: bestAdded,
    centroidDistanceKm: pmosHaversineKm_(target, centroid),
    customerCount: rows.length
  };
}

/** Compatibility entry retained for older clients; no Calendar mutation occurs. */
function createMaintenanceClient(input) {
  return createMaintenanceCustomer(input);
}

function makeRoomForMaintenanceStop_(sheet, table, layer, stop) {
  const values = sheet.getDataRange().getValues();
  const layerIndex = findHeaderIndex_(table.headers, ['Layer', 'Route Layer', 'Route Assignment']);
  const stopIndex = findHeaderIndex_(table.headers, ['Stop Order', 'Stop', 'Order']);
  if (layerIndex < 0 || stopIndex < 0) return;

  for (let row = values.length - 1; row >= table.headerRow; row--) {
    if (normalizeSyncValue_(values[row][layerIndex]) !== normalizeSyncValue_(layer)) continue;
    const current = Number(values[row][stopIndex] || 0);
    if (Number.isFinite(current) && current >= stop) {
      sheet.getRange(row + 1, stopIndex + 1).setValue(current + 1);
    }
  }
  table.rows.forEach(function (row) {
    if (normalizeSyncValue_(row[layerIndex]) !== normalizeSyncValue_(layer)) return;
    const current = Number(row[stopIndex] || 0);
    if (Number.isFinite(current) && current >= stop) row[stopIndex] = current + 1;
  });
}

function rollbackMaintenanceClientRows_(appended) {
  appended.slice().reverse().forEach(function (item) {
    try {
      if (item.sheet && item.row <= item.sheet.getLastRow()) item.sheet.deleteRow(item.row);
    } catch (ignored) {}
  });
}

function normalizeMaintenanceFrequency_(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'weekly') return 'Weekly';
  if (text === 'biweekly' || text === 'bi-weekly' || text === 'every other week') return 'Biweekly';
  if (text === 'monthly') return 'Monthly';
  if (text === 'twice weekly' || text === 'twice-weekly' || text === '2x weekly') return 'Twice Weekly';
  throw new Error('Frequency must be Weekly, Biweekly, Monthly, or Twice Weekly.');
}

function normalizeMaintenanceDay_(value) {
  const text = String(value || '').trim();
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const match = days.find(function (day) { return day.toLowerCase() === text.toLowerCase(); });
  if (!match) throw new Error('Service day must be Monday through Friday.');
  return match;
}

function parseMaintenanceStartDate_(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Service start date must use YYYY-MM-DD.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error('Service start date is invalid.');
  }
  return date;
}

function maintenanceWeeksForFrequency_(frequency, firstWeek) {
  if (frequency === 'Weekly' || frequency === 'Twice Weekly') return [1, 2, 3, 4];
  if (frequency === 'Biweekly') return firstWeek % 2 ? [1, 3] : [2, 4];
  return [firstWeek];
}

function ensureMaintenanceClientHeaders_(sheet, table, required) {
  const normalized = table.headers.map(normalizeSyncHeader_);
  const missing = required.filter(function (header) {
    return normalized.indexOf(normalizeSyncHeader_(header)) < 0;
  });
  if (!missing.length) return;
  sheet.getRange(table.headerRow, table.headers.length + 1, 1, missing.length).setValues([missing]);
}

function assertMaintenanceClientNotDuplicate_(table, name, address, email) {
  const nameIndex = findHeaderIndex_(table.headers, [
    'Customer Name', 'Full Name(s)', 'Name', 'Customer', 'Calendar Title'
  ]);
  const addressIndex = findHeaderIndex_(table.headers, [
    'Full Address', 'Address', 'Service Address', 'Street Address'
  ]);
  const emailIndex = findHeaderIndex_(table.headers, ['Email', 'Email Address']);
  const targetName = normalizeSyncValue_(name);
  const targetAddress = normalizeSyncValue_(address);
  const targetEmail = normalizeSyncValue_(email);
  const duplicate = table.rows.find(function (row) {
    const rowName = nameIndex >= 0 ? normalizeSyncValue_(row[nameIndex]) : '';
    const rowAddress = addressIndex >= 0 ? normalizeSyncValue_(row[addressIndex]) : '';
    const rowEmail = emailIndex >= 0 ? normalizeSyncValue_(row[emailIndex]) : '';
    return (targetEmail && rowEmail === targetEmail) ||
      (rowName === targetName && rowAddress === targetAddress);
  });
  if (duplicate) throw new Error('A matching customer already exists. No new records were created.');
}

function mappedMaintenanceRow_(headers, valuesByHeader) {
  const normalizedValues = {};
  Object.keys(valuesByHeader).forEach(function (key) {
    normalizedValues[normalizeSyncHeader_(key)] = valuesByHeader[key];
  });
  return headers.map(function (header) {
    const key = normalizeSyncHeader_(header);
    return Object.prototype.hasOwnProperty.call(normalizedValues, key)
      ? normalizedValues[key]
      : '';
  });
}

function appendMappedMaintenanceRow_(sheet, table, valuesByHeader) {
  const row = mappedMaintenanceRow_(table.headers, valuesByHeader);
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, table.headers.length).setValues([row]);
  return row;
}

function nextMaintenanceStopForLayer_(routeTable, layer) {
  const layerIndex = findHeaderIndex_(routeTable.headers, ['Layer', 'Route Layer', 'Route Assignment']);
  const stopIndex = findHeaderIndex_(routeTable.headers, ['Stop Order', 'Stop', 'Order']);
  let maximum = 0;
  routeTable.rows.forEach(function (row) {
    if (layerIndex < 0 || normalizeSyncValue_(row[layerIndex]) !== normalizeSyncValue_(layer)) return;
    const value = stopIndex >= 0 ? Number(row[stopIndex] || 0) : 0;
    if (Number.isFinite(value)) maximum = Math.max(maximum, value);
  });
  return maximum + 1;
}
