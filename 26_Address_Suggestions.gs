/**
 * Shared Canadian address suggestions for PMOS dialogs.
 * Google Apps Script's Maps geocoder does not expose Places Autocomplete, so
 * this returns the best formatted geocoding matches available for partial text.
 */
function suggestPmosAddresses(query, limit) {
  const text = String(query || '').trim();
  const maximum = Math.max(1, Math.min(8, Number(limit || 6)));
  if (text.length < 4) return [];

  const geocoder = Maps.newGeocoder().setRegion('ca');
  const variants = buildPmosAddressQueries_(text);
  const seen = {};
  const suggestions = [];

  variants.forEach(addressQuery => {
    if (suggestions.length >= maximum) return;
    let response;
    try {
      response = geocoder.geocode(addressQuery);
    } catch (error) {
      return;
    }

    const results = response && Array.isArray(response.results)
      ? response.results
      : [];

    results.forEach(result => {
      if (suggestions.length >= maximum) return;
      const formatted = String(result.formatted_address || '').trim();
      if (!formatted || !isLikelyCanadianAddress_(result, formatted)) return;
      const key = normalizePmosAddressSuggestion_(formatted);
      if (seen[key]) return;
      seen[key] = true;
      suggestions.push({
        address: formatted,
        latitude: Number(result.geometry && result.geometry.location && result.geometry.location.lat),
        longitude: Number(result.geometry && result.geometry.location && result.geometry.location.lng)
      });
    });
  });

  return suggestions;
}

function buildPmosAddressQueries_(text) {
  const queries = [text];
  if (!/\bcanada\b/i.test(text)) queries.push(text + ', Ontario, Canada');
  return queries;
}

function isLikelyCanadianAddress_(result, formatted) {
  const components = result && Array.isArray(result.address_components)
    ? result.address_components
    : [];
  const country = components.find(component =>
    Array.isArray(component.types) && component.types.indexOf('country') >= 0
  );
  if (country) return String(country.short_name || '').toUpperCase() === 'CA';
  return /\bCanada\b/i.test(formatted);
}

function normalizePmosAddressSuggestion_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
