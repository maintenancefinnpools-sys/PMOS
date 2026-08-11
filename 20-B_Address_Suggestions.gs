/**
 * Address suggestions shared by Add Maintenance Client and future PMOS forms.
 * Existing PMOS addresses rank first; Google geocoding supplements new addresses.
 */
function suggestPmosAddresses(query, limit) {
  const text = String(query || '').trim();
  const maximum = Math.max(1, Math.min(10, Number(limit || 6)));
  if (text.length < 3) return [];

  const normalizedQuery = normalizePmosAddressSearch_(text);
  const responseCache = CacheService.getScriptCache();
  const responseCacheKey = 'PMOS_ADDRESS_SUGGEST_' + pmosAddressCacheDigest_(
    normalizedQuery + '|' + maximum
  );
  const cachedResponse = responseCache.get(responseCacheKey);
  if (cachedResponse) {
    try { return JSON.parse(cachedResponse); } catch (ignored) {}
  }
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  const candidates = [];
  const seen = {};
  const anchor = getPmosAddressSearchAnchor_();

  collectPmosStoredAddresses_().forEach(item => {
    const address = String(item.address || '').trim();
    if (!address) return;
    const normalized = normalizePmosAddressSearch_(address);
    const score = scorePmosAddressMatch_(normalized, normalizedQuery, tokens);
    if (score <= 0) return;
    const key = normalized;
    if (!seen[key] || score > seen[key].score) {
      seen[key] = {
        address: address,
        source: item.source || 'PMOS',
        score: score,
        distanceFromServiceAreaKm: pmosAddressDistanceFromAnchor_(item, anchor)
      };
    }
  });

  Object.keys(seen).forEach(key => candidates.push(seen[key]));
  candidates.sort(comparePmosAddressCandidates_);

  let graphHopperCount = 0;
  if (text.length >= 3) {
    try {
      const graphHopperResults = suggestPmosGraphHopperAddresses_(text, maximum, anchor);
      graphHopperCount = graphHopperResults.length;
      graphHopperResults.forEach(function (resolved, index) {
        const key = normalizePmosAddressSearch_(resolved.address);
        if (seen[key]) return;
        seen[key] = Object.assign(resolved, {
          score: 650 - index,
          distanceFromServiceAreaKm: pmosAddressDistanceFromAnchor_(resolved, anchor)
        });
        candidates.push(seen[key]);
      });
    } catch (ignored) {}
  }

  if (!graphHopperCount && candidates.length < maximum && text.length >= 5) {
    try {
      let geocoder = Maps.newGeocoder().setRegion('ca');
      if (anchor && typeof geocoder.setBounds === 'function') {
        geocoder = geocoder.setBounds(
          anchor.lat - 1.75, anchor.lng - 2.25,
          anchor.lat + 1.75, anchor.lng + 2.25
        );
      }
      const response = geocoder.geocode(text);
      const results = response && Array.isArray(response.results) ? response.results : [];
      results.slice(0, maximum).forEach((result, index) => {
        const resolved = buildPmosResolvedAddress_(result, 'Google Maps');
        if (!resolved.complete) return;
        const address = resolved.address;
        const key = normalizePmosAddressSearch_(address);
        if (seen[key]) return;
        seen[key] = Object.assign(resolved, {
          score: 500 - index,
          distanceFromServiceAreaKm: pmosAddressDistanceFromAnchor_(resolved, anchor)
        });
        candidates.push(seen[key]);
      });
    } catch (ignored) {}
  }

  candidates.sort(comparePmosAddressCandidates_);
  const output = candidates.slice(0, maximum).map(function (item) {
    const result = Object.assign({}, item);
    delete result.score;
    delete result.distanceFromServiceAreaKm;
    return result;
  });
  responseCache.put(responseCacheKey, JSON.stringify(output), 1800);
  return output;
}

function preparePmosAddressSuggestions() {
  getPmosAddressSearchAnchor_();
  collectPmosStoredAddresses_();
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
  if (!apiKey) return [];
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
  cache.put('PMOS_ADDRESS_SEARCH_ANCHOR', JSON.stringify(anchor), 600);
  return anchor;
}

function collectPmosStoredAddresses_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('PMOS_STORED_ADDRESS_SUGGESTIONS');
  if (cached) {
    try { return JSON.parse(cached); } catch (ignored) {}
  }
  const ss = SpreadsheetApp.getActive();
  const sheets = [
    { names: ['Customers', 'Customer Database', 'Customer List'], source: 'Customers' },
    { names: ['4-Week Route Template', 'PMOS 4-Week Route Template', 'Route Template'], source: 'Route Template' }
  ];
  const results = [];

  sheets.forEach(definition => {
    const sheet = findFirstSheetByName_(ss, definition.names);
    if (!sheet) return;
    const table = readPmosHeaderTable_(sheet);
    const addressIndex = findHeaderIndex_(table.headers, [
      'Full Address', 'Service Address', 'Address', 'Street Address', 'Location'
    ]);
    const nameIndex = findHeaderIndex_(table.headers, [
      'Customer Name', 'Full Name(s)', 'Name', 'Customer', 'Calendar Title'
    ]);
    const latIndex = findHeaderIndex_(table.headers, ['Latitude', 'Lat']);
    const lngIndex = findHeaderIndex_(table.headers, ['Longitude', 'Lng', 'Lon']);
    if (addressIndex < 0) return;

    table.rows.forEach(row => {
      const address = String(row[addressIndex] || '').trim();
      if (!address) return;
      results.push({
        address,
        name: nameIndex >= 0 ? String(row[nameIndex] || '').trim() : '',
        source: definition.source,
        lat: latIndex >= 0 ? Number(row[latIndex]) : null,
        lng: lngIndex >= 0 ? Number(row[lngIndex]) : null
      });
    });
  });

  try { cache.put('PMOS_STORED_ADDRESS_SUGGESTIONS', JSON.stringify(results), 600); }
  catch (ignored) {}
  return results;
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

function scorePmosAddressMatch_(address, query, tokens) {
  if (!address || !query) return 0;
  if (address === query) return 1000;
  if (address.indexOf(query) === 0) return 900 - Math.min(100, address.length - query.length);
  if (address.indexOf(query) >= 0) return 750 - Math.min(100, address.indexOf(query));

  let matched = 0;
  tokens.forEach(token => {
    if (address.indexOf(token) >= 0) matched++;
  });
  if (!matched) return 0;
  if (matched < Math.ceil(tokens.length * 0.6)) return 0;
  return 400 + matched * 30 - Math.max(0, tokens.length - matched) * 20;
}
