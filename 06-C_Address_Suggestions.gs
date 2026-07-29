/**
 * Shared address suggestions for PMOS scheduling dialogs.
 * Uses the Apps Script Maps geocoder so no browser API key is exposed.
 */

function suggestPmosAddresses(query, maximum) {
  const text = String(query || '').trim();
  if (text.length < 4) return [];

  const limit = Math.max(1, Math.min(8, Number(maximum || 6)));
  const cache = CacheService.getScriptCache();
  const normalized = text.toLowerCase();
  const digest = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, normalized)
  ).replace(/=+$/, '');
  const cacheKey = `PMOS_ADDRESS_SUGGEST_${digest}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (ignored) {}
  }

  const geocoder = Maps.newGeocoder().setRegion('ca');
  const response = geocoder.geocode(text);
  const results = response && Array.isArray(response.results) ? response.results : [];
  const seen = {};
  const suggestions = [];

  results.forEach(result => {
    const formatted = String(result.formatted_address || '').trim();
    if (!formatted || seen[formatted.toLowerCase()]) return;
    seen[formatted.toLowerCase()] = true;
    const location = result.geometry && result.geometry.location;
    suggestions.push({
      address: formatted,
      lat: location ? Number(location.lat) : null,
      lng: location ? Number(location.lng) : null
    });
  });

  const limited = suggestions.slice(0, limit);
  try { cache.put(cacheKey, JSON.stringify(limited), 21600); } catch (ignored) {}
  return limited;
}
