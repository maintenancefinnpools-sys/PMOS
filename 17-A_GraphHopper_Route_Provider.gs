/** GraphHopper adapter for the provider-neutral Route Intelligence Engine. */
function routePmosGraphHopperLeg_(origin, destination, settings) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(PMOS_RIE_PROPERTIES.GRAPHHOPPER_KEY);
  if (!apiKey) throw new Error('GraphHopper API key is not configured.');
  const response = UrlFetchApp.fetch('https://graphhopper.com/api/1/route?key=' + encodeURIComponent(apiKey), {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      profile: settings.profile || 'car',
      points: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
      instructions: false,
      calc_points: false,
      points_encoded: false
    }),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  let body = {};
  try { body = JSON.parse(response.getContentText() || '{}'); } catch (ignored) {}
  if (status < 200 || status >= 300) {
    throw new Error('GraphHopper request failed (' + status + '): ' + sanitizePmosGraphHopperError_(body));
  }
  const path = body.paths && body.paths[0];
  if (!path) throw new Error('GraphHopper returned no driving route.');
  return {
    distanceMetres: Number(path.distance),
    durationMilliseconds: Number(path.time)
  };
}

function routePmosGraphHopperMatrix_(points, settings) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(PMOS_RIE_PROPERTIES.GRAPHHOPPER_KEY);
  if (!apiKey) throw new Error('GraphHopper API key is not configured.');
  const cacheText = [settings.profile || 'car'].concat(points.map(function (point) {
    return point.lat.toFixed(6) + ',' + point.lng.toFixed(6);
  })).join('|');
  const cacheKey = 'PMOS_RIE_MATRIX_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, cacheText)
  ).replace(/=+$/, '').slice(0, 80);
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (ignored) {}
  }
  const response = UrlFetchApp.fetch('https://graphhopper.com/api/1/matrix?key=' + encodeURIComponent(apiKey), {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      profile: settings.profile || 'car',
      points: points.map(function (point) { return [point.lng, point.lat]; }),
      out_arrays: ['distances', 'times'],
      fail_fast: true
    }),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  let body = {};
  try { body = JSON.parse(response.getContentText() || '{}'); } catch (ignored) {}
  if (status < 200 || status >= 300) {
    throw new Error('GraphHopper matrix request failed (' + status + '): ' + sanitizePmosGraphHopperError_(body));
  }
  if (!Array.isArray(body.distances) || !Array.isArray(body.times)) {
    throw new Error('GraphHopper returned an incomplete route matrix.');
  }
  const result = {
    distances: body.distances,
    times: body.times,
    provider: 'GRAPHHOPPER',
    providerLabel: 'GraphHopper',
    profile: settings.profile || 'car',
    cached: false
  };
  try { cache.put(cacheKey, JSON.stringify(result), 21600); } catch (ignored) {}
  return result;
}

function sanitizePmosGraphHopperError_(body) {
  return String(body && body.message || 'No error details returned.')
    .replace(/([?&]key=)[^&\s]+/gi, '$1REDACTED')
    .slice(0, 300);
}
