/**
 * GraphHopper-only live address suggestions shared by PMOS forms.
 * Google is used separately after selection to confirm the canonical address.
 */
function suggestPmosAddresses(query, limit, preferGoogle) {
  const text = String(query || '').trim();
  const maximum = Math.max(1, Math.min(10, Number(limit || 6)));
  if (text.length < 3) return [];
  const googleFirst = preferGoogle === true;

  const normalizedQuery = normalizePmosAddressSearch_(text);
  const responseCache = CacheService.getScriptCache();
  const responseCacheKey = 'PMOS_ADDRESS_ONTARIO_FALLBACK_V3_' + pmosAddressCacheDigest_(
    normalizedQuery + '|' + maximum + '|' + (googleFirst ? 'GOOGLE_FIRST' : 'GRAPHHOPPER_FIRST')
  );
  const cachedResponse = responseCache.get(responseCacheKey);
  if (cachedResponse) {
    try { return JSON.parse(cachedResponse); } catch (ignored) {}
  }
  const candidates = [];
  const seen = {};
  const anchor = getPmosAddressSearchAnchor_();
  if (googleFirst) {
    try {
      const confirmed = resolvePmosAddressSuggestion(text);
      if (!isPmosOntarioAddress_(confirmed)) return [];
      const output = [confirmed];
      responseCache.put(responseCacheKey, JSON.stringify(output), 1800);
      return output;
    } catch (ignored) {
      return [];
    }
  }
  let graphHopperResults = [];
  let graphHopperError = null;
  try {
    graphHopperResults = suggestPmosGraphHopperAddresses_(text, maximum, anchor);
  } catch (error) {
    graphHopperError = error;
  }
  graphHopperResults.forEach(function (resolved, index) {
    if (!isPmosOntarioAddress_(resolved)) return;
    const key = normalizePmosAddressSearch_(resolved.address);
    if (seen[key]) return;
    seen[key] = Object.assign(resolved, {
      score: 650 - index,
      distanceFromServiceAreaKm: pmosAddressDistanceFromAnchor_(resolved, anchor)
    });
    candidates.push(seen[key]);
  });

  // GraphHopper occasionally recognizes a valid Canadian address but omits a
  // postal code or municipality, causing its otherwise useful hit to be
  // rejected by PMOS's complete-address requirement. When no complete hit
  // survives, confirm the user's full text with Google and return one clean
  // canonical suggestion rather than presenting duplicate provider results.
  if (!candidates.length) {
    try {
      const confirmed = resolvePmosAddressSuggestion(text);
      if (isPmosOntarioAddress_(confirmed)) {
        candidates.push(Object.assign({}, confirmed, {
          score: 1000,
          distanceFromServiceAreaKm: pmosAddressDistanceFromAnchor_(confirmed, anchor)
        }));
      }
    } catch (googleError) {
      if (graphHopperError) throw graphHopperError;
    }
  }

  candidates.sort(comparePmosAddressCandidates_);
  const output = candidates.slice(0, maximum).map(function (item) {
    const result = Object.assign({}, item);
    delete result.score;
    delete result.distanceFromServiceAreaKm;
    return result;
  });
  // Do not preserve a temporary provider miss. A later attempt may succeed,
  // and an empty cache entry would prevent the Google confirmation fallback.
  if (output.length) responseCache.put(responseCacheKey, JSON.stringify(output), 1800);
  return output;
}

function isPmosOntarioAddress_(address) {
  const province = normalizePmosAddressSearch_(address && address.province);
  const country = normalizePmosAddressSearch_(address && address.country);
  const provinceMatches = province === 'ontario' || province === 'on';
  const countryMatches = !country || country === 'canada' || country === 'ca';
  return provinceMatches && countryMatches;
}

function preparePmosAddressSuggestions() {
  getPmosAddressSearchAnchor_();
  return true;
}

function pmosAddressCacheDigest_(text) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(text || ''))
  ).replace(/=+$/, '');
}

function suggestPmosGraphHopperAddresses_(query, limit, anchor) {
  const apiKey = PropertiesService.getScriptProperties()
    .getProperty(PMOS_RIE_PROPERTIES.GRAPHHOPPER_KEY);
  if (!apiKey) throw new Error('GraphHopper API key is not configured in Routing Settings.');
  const parameters = [
    'q=' + encodeURIComponent(query),
    'locale=en',
    'countrycode=ca',
    'limit=' + encodeURIComponent(String(Math.max(1, Math.min(10, Number(limit || 6))))),
    'key=' + encodeURIComponent(apiKey)
  ];
  if (anchor) parameters.push('point=' + encodeURIComponent(anchor.lat + ',' + anchor.lng));
  const response = UrlFetchApp.fetch('https://graphhopper.com/api/1/geocode?' + parameters.join('&'), {
    method: 'get',
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  let body = {};
  try { body = JSON.parse(response.getContentText() || '{}'); } catch (ignored) {}
  if (status < 200 || status >= 300) {
    throw new Error('GraphHopper address search failed (' + status + ').');
  }
  return (body.hits || []).map(function (hit) {
    const street = [String(hit.housenumber || '').trim(), String(hit.street || hit.name || '').trim()]
      .filter(Boolean).join(' ');
    const city = String(hit.city || hit.town || hit.village || hit.county || '').trim();
    const province = String(hit.state || '').trim();
    const postalCode = String(hit.postcode || '').trim();
    const country = String(hit.country || 'Canada').trim();
    const lat = Number(hit.point && hit.point.lat);
    const lng = Number(hit.point && hit.point.lng);
    const address = [
      street,
      city,
      [province, postalCode].filter(Boolean).join(' '),
      country
    ].filter(Boolean).join(', ');
    return {
      address: address,
      street: street,
      city: city,
      province: province,
      postalCode: postalCode,
      country: country,
      lat: lat,
      lng: lng,
      placeId: String(hit.osm_id || ''),
      source: 'GraphHopper',
      complete: Boolean(
        hit.housenumber && street && city && province && postalCode && country &&
        Number.isFinite(lat) && Number.isFinite(lng)
      )
    };
  }).filter(function (item) { return item.complete; });
}

function resolvePmosAddressSuggestion(address) {
  const text = String(address || '').trim();
  if (!text) throw new Error('Choose a complete service address.');
  const cache = CacheService.getScriptCache();
  const cacheKey = 'PMOS_CONFIRMED_ADDRESS_' + pmosAddressCacheDigest_(
    normalizePmosAddressSearch_(text)
  );
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (ignored) {}
  }
  const response = Maps.newGeocoder().setRegion('ca').geocode(text);
  const results = response && Array.isArray(response.results) ? response.results : [];
  for (let index = 0; index < results.length; index++) {
    const resolved = buildPmosResolvedAddress_(results[index], 'Google Maps');
    if (resolved.complete) {
      cache.put(cacheKey, JSON.stringify(resolved), 21600);
      return resolved;
    }
  }
  throw new Error(
    'PMOS could not confirm a complete street, city, province, postal code, and country for this address.'
  );
}

function confirmPmosSelectedAddress(candidate) {
  const selected = candidate || {};
  if (selected.complete && String(selected.source || '') === 'Google Maps') return selected;
  const confirmed = resolvePmosAddressSuggestion(selected.address);
  const selectedLat = Number(selected.lat);
  const selectedLng = Number(selected.lng);
  if (Number.isFinite(selectedLat) && Number.isFinite(selectedLng)) {
    const differenceKm = pmosHaversineKm_(
      {lat: selectedLat, lng: selectedLng},
      {lat: confirmed.lat, lng: confirmed.lng}
    );
    if (differenceKm > 1) {
      throw new Error(
        'GraphHopper and Google located this address more than 1 km apart. ' +
        'Choose another suggestion or verify the street and postal code.'
      );
    }
  }
  confirmed.suggestionSource = String(selected.source || 'PMOS');
  return confirmed;
}

function buildPmosResolvedAddress_(result, source) {
  const components = {};
  (result && result.address_components || []).forEach(function (component) {
    (component.types || []).forEach(function (type) {
      if (!components[type]) components[type] = component;
    });
  });
  const streetNumber = pmosAddressComponentValue_(components.street_number);
  const route = pmosAddressComponentValue_(components.route);
  const street = [streetNumber, route].filter(Boolean).join(' ');
  const cityComponent = components.locality || components.postal_town ||
    components.administrative_area_level_3 || components.administrative_area_level_2;
  const city = pmosAddressComponentValue_(cityComponent);
  const province = pmosAddressComponentValue_(components.administrative_area_level_1);
  const postalCode = pmosAddressComponentValue_(components.postal_code);
  const country = pmosAddressComponentValue_(components.country);
  const location = result && result.geometry && result.geometry.location || {};
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  const address = String(result && result.formatted_address || '').trim();
  const complete = Boolean(
    street && city && province && postalCode && country && address &&
    Number.isFinite(lat) && Number.isFinite(lng)
  );
  return {
    address: address,
    street: street,
    city: city,
    province: province,
    postalCode: postalCode,
    country: country,
    lat: lat,
    lng: lng,
    placeId: String(result && result.place_id || ''),
    source: String(source || 'Address provider'),
    complete: complete
  };
}

function pmosAddressComponentValue_(component) {
  return String(component && component.long_name || '').trim();
}

function comparePmosAddressCandidates_(left, right) {
  const leftDistance = Number(left.distanceFromServiceAreaKm);
  const rightDistance = Number(right.distanceFromServiceAreaKm);
  const leftGeographicPenalty = Number.isFinite(leftDistance) ? Math.min(300, leftDistance) * 1.5 : 0;
  const rightGeographicPenalty = Number.isFinite(rightDistance) ? Math.min(300, rightDistance) * 1.5 : 0;
  const leftRank = Number(left.score || 0) - leftGeographicPenalty;
  const rightRank = Number(right.score || 0) - rightGeographicPenalty;
  return rightRank - leftRank ||
    (Number.isFinite(leftDistance) ? leftDistance : Number.POSITIVE_INFINITY) -
      (Number.isFinite(rightDistance) ? rightDistance : Number.POSITIVE_INFINITY) ||
    String(left.address || '').localeCompare(String(right.address || ''));
}

function pmosAddressDistanceFromAnchor_(candidate, anchor) {
  if (!candidate || candidate.lat == null || candidate.lng == null) return null;
  const lat = Number(candidate && candidate.lat);
  const lng = Number(candidate && candidate.lng);
  if (!anchor || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return pmosHaversineKm_({lat: lat, lng: lng}, anchor);
}

function getPmosAddressSearchAnchor_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('PMOS_ADDRESS_SEARCH_ANCHOR');
  if (cached) {
    try { return JSON.parse(cached); } catch (ignored) {}
  }
  const documentProperties = PropertiesService.getDocumentProperties();
  const savedAnchor = documentProperties.getProperty('PMOS_ADDRESS_SEARCH_ANCHOR_V1');
  if (savedAnchor) {
    try {
      const saved = JSON.parse(savedAnchor);
      if (saved && saved.anchor && saved.updatedAt &&
          Date.now() - new Date(saved.updatedAt).getTime() < 24 * 60 * 60 * 1000) {
        cache.put('PMOS_ADDRESS_SEARCH_ANCHOR', JSON.stringify(saved.anchor), 21600);
        return saved.anchor;
      }
    } catch (ignored) {}
  }
  const points = [];
  const spreadsheet = SpreadsheetApp.getActive();
  ['Customers', '4-Week Route Template'].forEach(function (sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return;
    const table = readPmosHeaderTable_(sheet);
    const latIndex = findHeaderIndex_(table.headers, ['Latitude', 'Lat']);
    const lngIndex = findHeaderIndex_(table.headers, ['Longitude', 'Lng', 'Lon']);
    if (latIndex < 0 || lngIndex < 0) return;
    table.rows.forEach(function (row) {
      if (String(row[latIndex] == null ? '' : row[latIndex]).trim() === '' ||
          String(row[lngIndex] == null ? '' : row[lngIndex]).trim() === '') return;
      const lat = Number(row[latIndex]);
      const lng = Number(row[lngIndex]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) points.push({lat: lat, lng: lng});
    });
  });
  const cacheSheet = spreadsheet.getSheetByName(PMOS_RIE_CACHE_SHEET);
  if (cacheSheet && cacheSheet.getLastRow() > 1) {
    cacheSheet.getRange(2, 2, cacheSheet.getLastRow() - 1, 4).getValues().forEach(function (row) {
      [[row[0], row[1]], [row[2], row[3]]].forEach(function (pair) {
        if (String(pair[0] == null ? '' : pair[0]).trim() === '' ||
            String(pair[1] == null ? '' : pair[1]).trim() === '') return;
        const lat = Number(pair[0]);
        const lng = Number(pair[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) points.push({lat: lat, lng: lng});
      });
    });
  }
  if (!points.length) return null;
  const anchor = {
    lat: points.reduce(function (sum, point) { return sum + point.lat; }, 0) / points.length,
    lng: points.reduce(function (sum, point) { return sum + point.lng; }, 0) / points.length
  };
  cache.put('PMOS_ADDRESS_SEARCH_ANCHOR', JSON.stringify(anchor), 21600);
  documentProperties.setProperty('PMOS_ADDRESS_SEARCH_ANCHOR_V1', JSON.stringify({
    anchor: anchor,
    updatedAt: new Date().toISOString()
  }));
  return anchor;
}

function normalizePmosAddressSearch_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(street)\b/g, 'st')
    .replace(/\b(road)\b/g, 'rd')
    .replace(/\b(avenue)\b/g, 'ave')
    .replace(/\b(drive)\b/g, 'dr')
    .replace(/\b(lane)\b/g, 'ln')
    .replace(/\b(court)\b/g, 'ct')
    .replace(/\b(boulevard)\b/g, 'blvd')
    .replace(/\b(highway)\b/g, 'hwy')
    .replace(/\b(north)\b/g, 'n')
    .replace(/\b(south)\b/g, 's')
    .replace(/\b(east)\b/g, 'e')
    .replace(/\b(west)\b/g, 'w')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
