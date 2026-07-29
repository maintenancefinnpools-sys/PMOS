/**
 * Address suggestions shared by Add Maintenance Client and future PMOS forms.
 * Existing PMOS addresses rank first; Google geocoding supplements new addresses.
 */
function suggestPmosAddresses(query, limit) {
  const text = String(query || '').trim();
  const maximum = Math.max(1, Math.min(10, Number(limit || 6)));
  if (text.length < 3) return [];

  const normalizedQuery = normalizePmosAddressSearch_(text);
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  const candidates = [];
  const seen = {};

  collectPmosStoredAddresses_().forEach(item => {
    const address = String(item.address || '').trim();
    if (!address) return;
    const normalized = normalizePmosAddressSearch_(address);
    const score = scorePmosAddressMatch_(normalized, normalizedQuery, tokens);
    if (score <= 0) return;
    const key = normalized;
    if (!seen[key] || score > seen[key].score) {
      seen[key] = { address, source: item.source || 'PMOS', score };
    }
  });

  Object.keys(seen).forEach(key => candidates.push(seen[key]));
  candidates.sort((a, b) => b.score - a.score || a.address.localeCompare(b.address));

  if (candidates.length < maximum && text.length >= 5) {
    try {
      const response = Maps.newGeocoder().setRegion('ca').geocode(text);
      const results = response && Array.isArray(response.results) ? response.results : [];
      results.slice(0, maximum).forEach((result, index) => {
        const address = String(result.formatted_address || '').trim();
        if (!address) return;
        const key = normalizePmosAddressSearch_(address);
        if (seen[key]) return;
        seen[key] = { address, source: 'Google Maps', score: 500 - index };
        candidates.push(seen[key]);
      });
    } catch (ignored) {}
  }

  candidates.sort((a, b) => b.score - a.score || a.address.localeCompare(b.address));
  return candidates.slice(0, maximum).map(item => ({
    address: item.address,
    source: item.source
  }));
}

function collectPmosStoredAddresses_() {
  const ss = SpreadsheetApp.getActive();
  const sheets = [
    { names: ['Customers', 'Customer Database', 'Customer List'], source: 'Customers' },
    { names: ['4-Week Route Template', 'PMOS 4-Week Route Template', 'Route Template'], source: 'Route Template' }
  ];
  const results = [];

  sheets.forEach(definition => {
    const sheet = findFirstSheetByName_(ss, definition.names);
    if (!sheet) return;
    const table = readHeaderTable_(sheet);
    const addressIndex = findHeaderIndex_(table.headers, [
      'Full Address', 'Service Address', 'Address', 'Street Address', 'Location'
    ]);
    const nameIndex = findHeaderIndex_(table.headers, [
      'Customer Name', 'Full Name(s)', 'Name', 'Customer', 'Calendar Title'
    ]);
    if (addressIndex < 0) return;

    table.rows.forEach(row => {
      const address = String(row[addressIndex] || '').trim();
      if (!address) return;
      results.push({
        address,
        name: nameIndex >= 0 ? String(row[nameIndex] || '').trim() : '',
        source: definition.source
      });
    });
  });

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
