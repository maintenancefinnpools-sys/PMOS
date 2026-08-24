/**
 * Maintenance-customer route recommendations and shared transaction helpers.
 *
 * UI ownership lives in 20-C and the authoritative spreadsheet transaction
 * lives in 20-E. This module never creates customers or mutates Calendar.
 */
function recommendMaintenanceClientRotations(input) {
  input = input || {};
  const address = String(input.address || '').trim();
  if (!address) throw new Error('Enter the service address.');
  if (input.addressVerified !== true || !input.addressDetails ||
      normalizePmosAddressSearch_(input.addressDetails.address) !== normalizePmosAddressSearch_(address)) {
    throw new Error('Select a complete address suggestion before calculating route placement.');
  }
  const frequency = normalizeMaintenanceFrequency_(input.frequency || 'Weekly');
  const geocoder = Maps.newGeocoder().setRegion('ca');
  const geocodeMemo = {};
  const resolvePoint = function (candidateAddress, allowFailure) {
    const key = normalizePmosAddressSearch_(candidateAddress);
    if (Object.prototype.hasOwnProperty.call(geocodeMemo, key)) return geocodeMemo[key];
    const point = geocodePmosAddress_(geocoder, candidateAddress, allowFailure);
    geocodeMemo[key] = point;
    return point;
  };
  const target = normalizePmosRiePoint_({
    lat: input.addressDetails.lat,
    lng: input.addressDetails.lng
  });
  const excludedCustomerId = String(input.excludeCustomerId || '').trim().toUpperCase();
  const routes = readRoutesInPhysicalOrder_().filter(function (route) {
    return !excludedCustomerId || String(route.customerId || '').trim().toUpperCase() !== excludedCustomerId;
  });
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
      return scoreMaintenanceRotationCandidate_(routes, resolvePoint, target, candidate);
    })
    .filter(Boolean);
  scored.sort(function (a, b) {
    return b.score - a.score ||
      a.addedDistanceKm - b.addedDistanceKm ||
      a.customerCount - b.customerCount ||
      a.day.localeCompare(b.day);
  });

  const roadRefined = refineMaintenanceRecommendationsWithMatrix_(scored.slice(0, 3), target);
  rankMaintenanceRoadRecommendations_(roadRefined);

  const recommendations = roadRefined.map(function (item) {
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
    delete item._placementDetails;
    return item;
  });

  return {
    recommendations: recommendations,
    qualityMessage: recommendations.length
      ? (recommendations.every(function (item) { return item.roadDataComplete; })
        ? 'Best ' + frequency.toLowerCase() + ' placements calculated by the PMOS Route Intelligence Engine.'
        : 'Some GPS road calculations were unavailable. PMOS kept the geographic shortlist visible for manual review.')
      : 'No usable route placements were found. Manual placement remains available.'
  };
}

function compareMaintenanceRoadRecommendations_(a, b) {
  if (a.roadDataComplete !== b.roadDataComplete) return a.roadDataComplete ? -1 : 1;
  const balancedDifference = Number(a._balancedRouteCost || 0) -
    Number(b._balancedRouteCost || 0);
  if (Math.abs(balancedDifference) > 0.000001) return balancedDifference;

  // When the complete recommendation is effectively tied, prefer the
  // less-loaded route, then driving time, then driving distance.
  return Number(a.customerCount || 0) - Number(b.customerCount || 0) ||
    maintenanceRoadMetric_(a.addedDurationMinutes) -
      maintenanceRoadMetric_(b.addedDurationMinutes) ||
    maintenanceRoadMetric_(a.addedDistanceKm) -
      maintenanceRoadMetric_(b.addedDistanceKm) ||
    maintenanceRoadMetric_(a.estimatedRouteMinutes) -
      maintenanceRoadMetric_(b.estimatedRouteMinutes) ||
    Number(b.score || 0) - Number(a.score || 0);
}

function rankMaintenanceRoadRecommendations_(items) {
  const recommendations = items || [];
  const complete = recommendations.filter(function (item) {
    return item && item.roadDataComplete;
  });
  const ranges = {
    route: maintenanceRoadRange_(complete, 'estimatedRouteMinutes'),
    stops: maintenanceRoadRange_(complete, 'customerCount'),
    addedTime: maintenanceRoadRange_(complete, 'addedDurationMinutes'),
    addedDistance: maintenanceRoadRange_(complete, 'addedDistanceKm')
  };
  const weights = getPmosRieSettings_().rankingWeights;
  complete.forEach(function (item) {
    // Route-day selection uses the configured recommendation mix. Exact
    // insertion positions remain independently optimized for added road time.
    item._balancedRouteCost =
      maintenanceNormalizedRoadCost_(item.estimatedRouteMinutes, ranges.route) * weights.route / 100 +
      maintenanceNormalizedRoadCost_(item.customerCount, ranges.stops) * weights.stops / 100 +
      maintenanceNormalizedRoadCost_(item.addedDurationMinutes, ranges.addedTime) * weights.addedTime / 100 +
      maintenanceNormalizedRoadCost_(item.addedDistanceKm, ranges.addedDistance) * weights.addedDistance / 100;
  });
  recommendations.sort(compareMaintenanceRoadRecommendations_);
  recommendations.forEach(function (item) { delete item._balancedRouteCost; });
  return recommendations;
}

function maintenanceRoadRange_(items, propertyName) {
  const values = (items || []).map(function (item) {
    return Number(item[propertyName]);
  }).filter(Number.isFinite);
  return {
    min: values.length ? Math.min.apply(null, values) : 0,
    max: values.length ? Math.max.apply(null, values) : 0
  };
}

function maintenanceNormalizedRoadCost_(value, range) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  const span = Number(range.max) - Number(range.min);
  return span > 0 ? (number - Number(range.min)) / span : 0;
}

function maintenanceRoadMetric_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.POSITIVE_INFINITY;
}

function scoreMaintenanceRotationCandidate_(routes, resolvePoint, target, candidate) {
  const serviceDays = candidate.secondDay
    ? [candidate.day, candidate.secondDay]
    : [candidate.day];
  const placements = [];
  candidate.weeks.forEach(function (week) {
    serviceDays.forEach(function (day) {
      const layerPlacements = listMaintenanceLayersForWeekDay_(routes, week, day)
        .map(function (layer) {
          return maintenanceLayerInsertion_(routes, resolvePoint, target, layer);
        })
        .sort(function (left, right) {
          return left.addedDistanceKm - right.addedDistanceKm ||
            left.customerCount - right.customerCount ||
            left.layer.localeCompare(right.layer);
        });
      if (layerPlacements.length) placements.push(layerPlacements[0]);
    });
  });
  if (placements.length !== candidate.weeks.length * serviceDays.length) return null;

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
    placements: placements.map(function (placement) {
      return {
        week: parseLayer_(placement.layer).week,
        day: parseLayer_(placement.layer).day,
        layer: placement.layer,
        position: placement.position,
        isFirstStop: placement.position === 1,
        isLastStop: placement.position === Number(placement.customerCount || 0) + 1
      };
    }),
    _placementDetails: placements,
    score: Math.max(
      0,
      Math.min(100, Math.round(distanceScore * 0.7 + continuityScore * 0.3 - loadPenalty))
    )
  };
}

function maintenanceLayerInsertion_(routes, resolvePoint, target, layerName) {
  const rows = routes
    .filter(function (row) { return normalize_(row.layer) === normalize_(layerName); })
    .sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
  const points = rows.map(function (row) {
    return row.address ? resolvePoint(row.address, true) : null;
  });
  const valid = points.filter(Boolean);
  const validTitles = [];
  points.forEach(function (point, index) {
    if (point) validTitles.push(String(rows[index].title || ''));
  });
  if (!rows.length || !valid.length) {
    return {
      layer: layerName,
      position: 1,
      previousName: '',
      nextName: '',
      addedDistanceKm: 0,
      centroidDistanceKm: 0,
      customerCount: rows.length,
      routePoints: [],
      insertedPoints: [target]
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
  const insertedPoints = points.slice();
  insertedPoints.splice(bestPosition - 1, 0, target);
  return {
    layer: layerName,
    position: bestPosition,
    previousName: bestPosition > 1 ? String(rows[bestPosition - 2].title || '') : '',
    nextName: bestPosition <= rows.length ? String(rows[bestPosition - 1].title || '') : '',
    addedDistanceKm: bestAdded,
    centroidDistanceKm: pmosHaversineKm_(target, centroid),
    customerCount: rows.length,
    previousPoint: bestPosition > 1 ? points[bestPosition - 2] : null,
    nextPoint: bestPosition <= rows.length ? points[bestPosition - 1] : null,
    routePoints: points.filter(Boolean),
    routeTitles: validTitles,
    insertedPoints: insertedPoints.filter(Boolean)
  };
}

function refineMaintenanceRecommendationsWithMatrix_(items, target) {
  const recommendations = items || [];
  const points = [];
  const pointIndexes = {};
  const addPoint = function (point) {
    if (!point) return;
    const normalized = normalizePmosRiePoint_(point);
    const key = normalized.lat.toFixed(6) + ',' + normalized.lng.toFixed(6);
    if (Object.prototype.hasOwnProperty.call(pointIndexes, key)) return;
    pointIndexes[key] = points.length;
    points.push(normalized);
  };
  addPoint(target);
  recommendations.forEach(function (item) {
    (item._placementDetails || []).forEach(function (placement) {
      (placement.insertedPoints || []).forEach(addPoint);
    });
  });
  if (points.length < 2 || points.length > 80) {
    return recommendations.map(function (item) {
      return refineMaintenanceRecommendationWithDirections_(item, target);
    });
  }
  try {
    const matrix = matrixPmosWithRie_(points);
    return recommendations.map(function (item) {
      return refineMaintenanceRecommendationFromMatrix_(item, target, matrix, pointIndexes);
    });
  } catch (ignored) {
    return recommendations.map(function (item) {
      return refineMaintenanceRecommendationWithDirections_(item, target);
    });
  }
}

function refineMaintenanceRecommendationFromMatrix_(item, target, matrix, pointIndexes) {
  const details = item._placementDetails || [];
  let totalAddedDistanceKm = 0;
  let totalAddedDurationMinutes = 0;
  let totalRouteDistanceKm = 0;
  let totalRouteDriveMinutes = 0;
  let complete = details.length > 0;
  details.forEach(function (placement) {
    const optimized = choosePmosMatrixInsertion_(placement, target, matrix, pointIndexes);
    if (!optimized) { complete = false; return; }
    placement.position = optimized.position;
    placement.previousName = optimized.previousName;
    placement.nextName = optimized.nextName;
    placement.insertedPoints = optimized.insertedPoints;
    totalAddedDistanceKm += optimized.addedDistanceKm;
    totalAddedDurationMinutes += optimized.addedDurationMinutes;
    totalRouteDistanceKm += optimized.routeDistanceKm;
    totalRouteDriveMinutes += optimized.routeDurationMinutes;
  });
  if (!complete) return refineMaintenanceRecommendationWithDirections_(item, target);
  item.placements = details.map(function (placement) {
    const parsed = parseLayer_(placement.layer);
    return {
      week: parsed.week,
      day: parsed.day,
      layer: placement.layer,
      position: placement.position,
      isFirstStop: placement.position === 1,
      isLastStop: placement.position === Number(placement.customerCount || 0) + 1
    };
  });
  if (details[0]) {
    item.position = details[0].position;
    item.previousName = details[0].previousName;
    item.nextName = details[0].nextName;
  }
  item.addedDistanceKm = totalAddedDistanceKm / details.length;
  item.addedDurationMinutes = totalAddedDurationMinutes / details.length;
  item.routeDistanceKm = totalRouteDistanceKm / details.length;
  item.routeDriveMinutes = totalRouteDriveMinutes / details.length;
  item.serviceMinutes = getPmosRieSettings_().serviceMinutes;
  item.estimatedRouteMinutes = item.routeDriveMinutes +
    (Number(item.customerCount || 0) + 1) * item.serviceMinutes;
  item.routeProvider = matrix.providerLabel || 'GraphHopper';
  item.roadDataComplete = true;
  item.score = Math.max(0, Math.min(100, Math.round(
    100 - Math.min(80, item.addedDurationMinutes * 3.5) -
    Math.max(0, Number(item.customerCount || 0) - 15) * 0.7
  )));
  return item;
}

function choosePmosMatrixInsertion_(placement, target, matrix, pointIndexes) {
  const route = (placement.routePoints || []).filter(Boolean);
  const titles = placement.routeTitles || [];
  const base = sumPmosMatrixRoute_(route, matrix, pointIndexes);
  if (!base) return null;
  let best = null;
  for (let position = 0; position <= route.length; position++) {
    const insertedPoints = route.slice();
    insertedPoints.splice(position, 0, target);
    const inserted = sumPmosMatrixRoute_(insertedPoints, matrix, pointIndexes);
    if (!inserted) continue;
    const candidate = {
      position: position + 1,
      previousName: position > 0 ? String(titles[position - 1] || '') : '',
      nextName: position < titles.length ? String(titles[position] || '') : '',
      insertedPoints: insertedPoints,
      addedDistanceKm: Math.max(0, inserted.distanceKm - base.distanceKm),
      addedDurationMinutes: Math.max(0, inserted.durationMinutes - base.durationMinutes),
      routeDistanceKm: inserted.distanceKm,
      routeDurationMinutes: inserted.durationMinutes
    };
    if (!best || candidate.addedDurationMinutes < best.addedDurationMinutes ||
        (candidate.addedDurationMinutes === best.addedDurationMinutes &&
          candidate.addedDistanceKm < best.addedDistanceKm)) best = candidate;
  }
  return best;
}

function sumPmosMatrixRoute_(routePoints, matrix, pointIndexes) {
  const route = (routePoints || []).filter(Boolean);
  if (route.length < 2) return {distanceKm: 0, durationMinutes: 0};
  let distanceMetres = 0;
  let durationSeconds = 0;
  for (let index = 1; index < route.length; index++) {
    const from = normalizePmosRiePoint_(route[index - 1]);
    const to = normalizePmosRiePoint_(route[index]);
    const fromIndex = pointIndexes[from.lat.toFixed(6) + ',' + from.lng.toFixed(6)];
    const toIndex = pointIndexes[to.lat.toFixed(6) + ',' + to.lng.toFixed(6)];
    const rawDistance = matrix.distances[fromIndex] && matrix.distances[fromIndex][toIndex];
    const rawDuration = matrix.times[fromIndex] && matrix.times[fromIndex][toIndex];
    if (rawDistance == null || rawDuration == null) return null;
    const distance = Number(rawDistance);
    const duration = Number(rawDuration);
    if (!Number.isFinite(distance) || !Number.isFinite(duration)) return null;
    distanceMetres += distance;
    durationSeconds += duration;
  }
  return {distanceKm: distanceMetres / 1000, durationMinutes: durationSeconds / 60};
}

function refineMaintenanceRecommendationWithDirections_(item, target) {
  const details = item._placementDetails || [];
  let totalDistanceKm = 0;
  let totalDurationMinutes = 0;
  let totalRouteDistanceKm = 0;
  let totalRouteDriveMinutes = 0;
  const providers = [];
  let complete = details.length > 0;
  details.forEach(function (placement) {
    try {
      const metric = pmosDrivingInsertionImpact_(
        placement.previousPoint,
        target,
        placement.nextPoint
      );
      if (!metric) { complete = false; return; }
      totalDistanceKm += metric.addedDistanceKm;
      totalDurationMinutes += metric.addedDurationMinutes;
      const fullRoute = placement.insertedPoints.length >= 2
        ? pmosDrivingRouteMetric_(placement.insertedPoints) : null;
      if (!fullRoute) { complete = false; return; }
      totalRouteDistanceKm += fullRoute.distanceKm;
      totalRouteDriveMinutes += fullRoute.durationMinutes;
      if (providers.indexOf(fullRoute.providerLabel) < 0) providers.push(fullRoute.providerLabel);
    } catch (ignored) {
      complete = false;
    }
  });
  if (complete) {
    item.addedDistanceKm = totalDistanceKm / details.length;
    item.addedDurationMinutes = totalDurationMinutes / details.length;
    item.routeDistanceKm = totalRouteDistanceKm / details.length;
    item.routeDriveMinutes = totalRouteDriveMinutes / details.length;
    item.serviceMinutes = getPmosRieSettings_().serviceMinutes;
    item.estimatedRouteMinutes = item.routeDriveMinutes +
      (Number(item.customerCount || 0) + 1) * item.serviceMinutes;
    item.routeProvider = providers.join(' + ');
    item.score = Math.max(0, Math.min(100, Math.round(
      100 - Math.min(80, item.addedDurationMinutes * 3.5) -
      Math.max(0, Number(item.customerCount || 0) - 15) * 0.7
    )));
  } else {
    item.addedDurationMinutes = null;
    item.routeDistanceKm = null;
    item.routeDriveMinutes = null;
    item.estimatedRouteMinutes = null;
    item.serviceMinutes = getPmosRieSettings_().serviceMinutes;
    item.routeProvider = '';
  }
  item.roadDataComplete = complete;
  return item;
}

function pmosDrivingInsertionImpact_(previous, target, next) {
  if (!previous && !next) {
    return {addedDistanceKm: 0, addedDurationMinutes: 0};
  }
  if (!previous || !next) {
    const edge = pmosDrivingRouteMetric_(previous ? [previous, target] : [target, next]);
    return edge ? {
      addedDistanceKm: edge.distanceKm,
      addedDurationMinutes: edge.durationMinutes,
      providerLabel: edge.providerLabel
    } : null;
  }
  const inserted = pmosDrivingRouteMetric_([previous, target, next]);
  const direct = pmosDrivingRouteMetric_([previous, next]);
  if (!inserted || !direct) return null;
  return {
    addedDistanceKm: Math.max(0, inserted.distanceKm - direct.distanceKm),
    addedDurationMinutes: Math.max(0, inserted.durationMinutes - direct.durationMinutes),
    providerLabel: inserted.providerLabel
  };
}

function pmosDrivingRouteMetric_(points) {
  if (!Array.isArray(points) || points.length < 2 || points.some(function (point) { return !point; })) {
    return null;
  }
  return routePmosWithRie_(points);
}

function listMaintenanceLayersForWeekDay_(routes, week, day) {
  const layers = {};
  (routes || []).forEach(function (row) {
    const layer = String(row.layer || '').trim();
    if (!layer || layers[layer]) return;
    try {
      const parsed = parseLayer_(layer);
      if (parsed.week === Number(week) && parsed.day === day) layers[layer] = true;
    } catch (ignored) {}
  });
  return Object.keys(layers).sort(routeSort_);
}

function resolveMaintenanceLayer_(routeTable, week, day, preferredLayer) {
  const layerIndex = findHeaderIndex_(routeTable.headers, [
    'Layer', 'Route Layer', 'Route Assignment'
  ]);
  if (layerIndex < 0) throw new Error('4-Week Route Template is missing the Layer column.');
  const routes = routeTable.rows.map(function (row) {
    return {layer: String(row[layerIndex] || '').trim()};
  });
  const matches = listMaintenanceLayersForWeekDay_(routes, week, day);
  const preferred = String(preferredLayer || '').trim();
  if (preferred && matches.indexOf(preferred) >= 0) return preferred;
  if (matches.length === 1) return matches[0];
  if (!matches.length) {
    throw new Error('No Route Template layer exists for Week ' + week + ' - ' + day + '.');
  }
  throw new Error(
    'More than one Route Template layer exists for Week ' + week + ' - ' + day +
    '. Choose a route recommendation so PMOS can select the intended layer.'
  );
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
  const todayText = Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
  if (text < todayText) {
    throw new Error('Service start date cannot be before today (' + todayText + ').');
  }
  const settings = getRecurringCalendarSettings_();
  const seasonEnd = Utilities.formatDate(settings.seasonEnd, PMOS.TIMEZONE, 'yyyy-MM-dd');
  if (text > seasonEnd) {
    throw new Error('Service start date is after the configured season end (' + seasonEnd + ').');
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

function readPmosHeaderTable_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error('Sheet is empty: ' + sheet.getName());
  const known = [
    'customer id', 'calendar title', 'full name(s)', 'full address',
    'layer', 'stop order', 'frequency'
  ].map(normalizeSyncHeader_);
  let headerIndex = 0;
  let bestScore = -1;
  values.slice(0, Math.min(10, values.length)).forEach(function (row, index) {
    const normalized = row.map(normalizeSyncHeader_);
    const score = known.reduce(function (total, header) {
      return total + (normalized.indexOf(header) >= 0 ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = index;
    }
  });
  const headers = values[headerIndex].map(function (value) {
    return String(value || '').trim();
  });
  return {
    headerRow: headerIndex + 1,
    headers: headers,
    rows: values.slice(headerIndex + 1).filter(function (row) {
      return row.some(function (value) { return value !== '' && value != null; });
    })
  };
}

function findFirstSheetByName_(spreadsheet, names) {
  const candidates = names || [];
  for (let index = 0; index < candidates.length; index++) {
    const sheet = spreadsheet.getSheetByName(candidates[index]);
    if (sheet) return sheet;
  }
  return null;
}

function normalizeSyncHeader_(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeSyncValue_(value) {
  return normalize_(value);
}

function findHeaderIndex_(headers, candidates) {
  const normalized = (headers || []).map(normalizeSyncHeader_);
  const options = (candidates || []).map(normalizeSyncHeader_);
  for (let index = 0; index < options.length; index++) {
    const match = normalized.indexOf(options[index]);
    if (match >= 0) return match;
  }
  return -1;
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
