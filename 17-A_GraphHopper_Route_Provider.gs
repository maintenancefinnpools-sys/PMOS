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

function sanitizePmosGraphHopperError_(body) {
  return String(body && body.message || 'No error details returned.')
    .replace(/([?&]key=)[^&\s]+/gi, '$1REDACTED')
    .slice(0, 300);
}
