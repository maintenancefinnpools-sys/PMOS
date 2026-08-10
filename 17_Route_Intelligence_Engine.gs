/**
 * PMOS Route Intelligence Engine (RIE).
 * Callers consume normalized road metrics and never call a provider directly.
 */
const PMOS_RIE_PROPERTIES = Object.freeze({
  PROVIDER: 'PMOS_RIE_PROVIDER',
  GRAPHHOPPER_KEY: 'PMOS_RIE_GRAPHHOPPER_API_KEY',
  CACHE_DAYS: 'PMOS_RIE_CACHE_DAYS',
  START_MODE: 'PMOS_RIE_START_MODE',
  START_ADDRESS: 'PMOS_RIE_START_ADDRESS',
  FINISH_MODE: 'PMOS_RIE_FINISH_MODE',
  FINISH_ADDRESS: 'PMOS_RIE_FINISH_ADDRESS',
  OPTIMIZATION: 'PMOS_RIE_OPTIMIZATION',
  SERVICE_MINUTES: 'PMOS_RIE_SERVICE_MINUTES'
});

var PMOS_RIE_MEMORY_CACHE = {};

function getPmosRieSettings_() {
  const properties = PropertiesService.getScriptProperties();
  const key = String(properties.getProperty(PMOS_RIE_PROPERTIES.GRAPHHOPPER_KEY) || '');
  return {
    provider: normalizePmosRieProvider_(properties.getProperty(PMOS_RIE_PROPERTIES.PROVIDER) || 'GRAPHHOPPER'),
    profile: 'car',
    graphHopperConfigured: Boolean(key),
    graphHopperKeySuffix: key ? key.slice(-4) : '',
    cacheDays: clampPmosRieNumber_(properties.getProperty(PMOS_RIE_PROPERTIES.CACHE_DAYS), 1, 365, 30),
    startMode: normalizePmosRieEndpointMode_(properties.getProperty(PMOS_RIE_PROPERTIES.START_MODE) || 'SHOP'),
    startAddress: String(properties.getProperty(PMOS_RIE_PROPERTIES.START_ADDRESS) || ''),
    finishMode: normalizePmosRieEndpointMode_(properties.getProperty(PMOS_RIE_PROPERTIES.FINISH_MODE) || 'SHOP'),
    finishAddress: String(properties.getProperty(PMOS_RIE_PROPERTIES.FINISH_ADDRESS) || ''),
    optimization: normalizePmosRiePreference_(properties.getProperty(PMOS_RIE_PROPERTIES.OPTIMIZATION) || 'BALANCED'),
    serviceMinutes: clampPmosRieNumber_(properties.getProperty(PMOS_RIE_PROPERTIES.SERVICE_MINUTES), 0, 240, 20),
    automaticFallback: true
  };
}

function routePmosWithRie_(points, options) {
  const coordinates = (points || []).map(normalizePmosRiePoint_);
  if (coordinates.length < 2) throw new Error('RIE requires at least an origin and destination.');
  const settings = getPmosRieSettings_();
  const legs = [];
  for (let index = 1; index < coordinates.length; index++) {
    legs.push(routePmosRieLeg_(coordinates[index - 1], coordinates[index], settings, options));
  }
  const providers = [];
  const metric = legs.reduce(function (result, leg) {
    result.distanceMetres += leg.distanceMetres;
    result.durationMilliseconds += leg.durationMilliseconds;
    result.cached = result.cached && leg.cached;
    if (providers.indexOf(leg.provider) < 0) providers.push(leg.provider);
    return result;
  }, {distanceMetres: 0, durationMilliseconds: 0, cached: true});
  metric.distanceKm = metric.distanceMetres / 1000;
  metric.durationMinutes = metric.durationMilliseconds / 60000;
  metric.provider = providers.join(' + ');
  metric.providerLabel = providers.map(pmosRieProviderLabel_).join(' + ');
  metric.fallbackUsed = providers.some(function (provider) { return provider !== settings.provider; });
  metric.profile = settings.profile;
  metric.legs = legs;
  return metric;
}

function routePmosRieLeg_(origin, destination, settings, options) {
  const allowFallback = !options || options.allowFallback !== false;
  const order = settings.provider === 'GOOGLE'
    ? ['GOOGLE', 'GRAPHHOPPER'] : ['GRAPHHOPPER', 'GOOGLE'];
  const failures = [];
  for (let index = 0; index < order.length; index++) {
    const providerName = order[index];
    if (!allowFallback && providerName !== settings.provider) continue;
    if (providerName === 'GRAPHHOPPER' && !settings.graphHopperConfigured) continue;
    const cacheKey = makePmosRieCacheKey_(origin, destination, providerName, settings.profile);
    const cached = readPmosRieCache_(cacheKey, settings.cacheDays);
    if (cached) return cached;
    try {
      const provider = getPmosRouteProvider_(providerName);
      const result = provider.route(origin, destination, settings);
      const normalized = normalizePmosRieMetric_(result, providerName, settings.profile);
      writePmosRieCache_(cacheKey, origin, destination, normalized);
      normalized.cached = false;
      return normalized;
    } catch (error) {
      failures.push(providerName + ': ' + String(error && error.message || error));
    }
  }
  throw new Error('RIE could not calculate a driving route. ' + failures.join(' | '));
}

function getPmosRouteProvider_(providerName) {
  if (providerName === 'GRAPHHOPPER') return {route: routePmosGraphHopperLeg_};
  if (providerName === 'GOOGLE') return {route: routePmosGoogleLeg_};
  throw new Error('Unsupported RIE provider: ' + providerName);
}

function routePmosGoogleLeg_(origin, destination) {
  const response = Maps.newDirectionFinder()
    .setOrigin(origin.lat, origin.lng)
    .setDestination(destination.lat, destination.lng)
    .setMode(Maps.DirectionFinder.Mode.DRIVING)
    .setRegion('ca')
    .getDirections();
  const route = response && response.routes && response.routes[0];
  const leg = route && route.legs && route.legs[0];
  if (!leg) throw new Error('Google Maps returned no driving route.');
  return {
    distanceMetres: Number(leg.distance && leg.distance.value || 0),
    durationMilliseconds: Number(leg.duration && leg.duration.value || 0) * 1000
  };
}

function normalizePmosRieMetric_(metric, provider, profile) {
  const distance = Number(metric && metric.distanceMetres);
  const duration = Number(metric && metric.durationMilliseconds);
  if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(duration) || duration < 0) {
    throw new Error(pmosRieProviderLabel_(provider) + ' returned an invalid route metric.');
  }
  return {
    distanceMetres: distance,
    durationMilliseconds: duration,
    distanceKm: distance / 1000,
    durationMinutes: duration / 60000,
    provider: provider,
    providerLabel: pmosRieProviderLabel_(provider),
    profile: profile,
    cached: false
  };
}

function normalizePmosRiePoint_(point) {
  const lat = Number(point && point.lat);
  const lng = Number(point && point.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('RIE received an invalid GPS coordinate.');
  }
  return {lat: lat, lng: lng};
}

function makePmosRieCacheKey_(origin, destination, provider, profile) {
  const text = [
    'RIE1', provider, profile,
    origin.lat.toFixed(6), origin.lng.toFixed(6),
    destination.lat.toFixed(6), destination.lng.toFixed(6)
  ].join('|');
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text)
  ).replace(/=+$/, '');
}

function ensurePmosRieCacheSheet_() {
  const spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getSheetByName(PMOS_RIE_CACHE_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(PMOS_RIE_CACHE_SHEET);
    sheet.getRange(1, 1, 1, PMOS_RIE_CACHE_HEADERS.length).setValues([PMOS_RIE_CACHE_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.hideSheet();
  }
  const headers = sheet.getRange(1, 1, 1, PMOS_RIE_CACHE_HEADERS.length).getValues()[0];
  PMOS_RIE_CACHE_HEADERS.forEach(function (header, index) {
    if (String(headers[index] || '') !== header) {
      throw new Error(PMOS_RIE_CACHE_SHEET + ' has an invalid header in column ' + (index + 1) + '.');
    }
  });
  if (!sheet.isSheetHidden()) sheet.hideSheet();
  return sheet;
}

function readPmosRieCache_(cacheKey, cacheDays) {
  if (PMOS_RIE_MEMORY_CACHE[cacheKey]) return Object.assign({}, PMOS_RIE_MEMORY_CACHE[cacheKey], {cached: true});
  const sheet = ensurePmosRieCacheSheet_();
  if (sheet.getLastRow() < 2) return null;
  const match = sheet.getRange(2, 1, sheet.getLastRow() - 1, PMOS_RIE_CACHE_HEADERS.length)
    .createTextFinder(cacheKey).matchEntireCell(true).findNext();
  if (!match) return null;
  const row = sheet.getRange(match.getRow(), 1, 1, PMOS_RIE_CACHE_HEADERS.length).getValues()[0];
  const calculatedAt = row[9] instanceof Date ? row[9] : new Date(row[9]);
  if (!calculatedAt || !Number.isFinite(calculatedAt.getTime()) ||
      Date.now() - calculatedAt.getTime() > Number(cacheDays) * 86400000) {
    return null;
  }
  const metric = normalizePmosRieMetric_({
    distanceMetres: row[5], durationMilliseconds: row[6]
  }, String(row[7]), String(row[8]));
  metric.cached = true;
  PMOS_RIE_MEMORY_CACHE[cacheKey] = metric;
  return metric;
}

function writePmosRieCache_(cacheKey, origin, destination, metric) {
  const sheet = ensurePmosRieCacheSheet_();
  const row = [cacheKey, origin.lat, origin.lng, destination.lat, destination.lng,
    metric.distanceMetres, metric.durationMilliseconds, metric.provider, metric.profile, new Date()];
  const existing = sheet.getLastRow() < 2 ? null : sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(cacheKey).matchEntireCell(true).findNext();
  if (existing) sheet.getRange(existing.getRow(), 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  PMOS_RIE_MEMORY_CACHE[cacheKey] = Object.assign({}, metric);
}

function pmosRieProviderLabel_(provider) {
  return provider === 'GRAPHHOPPER' ? 'GraphHopper' : provider === 'GOOGLE' ? 'Google Maps' : String(provider);
}

function normalizePmosRieProvider_(value) {
  const provider = String(value || '').trim().toUpperCase();
  if (provider !== 'GRAPHHOPPER' && provider !== 'GOOGLE') throw new Error('Choose GraphHopper or Google Maps.');
  return provider;
}

function normalizePmosRieEndpointMode_(value) {
  const mode = String(value || '').trim().toUpperCase();
  if (['SHOP', 'LAST_STOP', 'CUSTOM'].indexOf(mode) < 0) throw new Error('Choose Shop, Last stop, or Custom address.');
  return mode;
}

function normalizePmosRiePreference_(value) {
  const preference = String(value || '').trim().toUpperCase();
  if (['BALANCED', 'TIME', 'DISTANCE'].indexOf(preference) < 0) throw new Error('Choose Balanced, Time, or Distance optimization.');
  return preference;
}

function clampPmosRieNumber_(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}
