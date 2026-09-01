/**
 * Shared address-autocomplete response acceleration.
 *
 * The authoritative provider remains GraphHopper-first with Google confirmation.
 * Successful suggestion sets are also cached under short normalized prefixes so
 * consecutive keystrokes can often be satisfied without another provider call.
 */
(function () {
  if (typeof suggestPmosAddresses !== 'function') return;
  const baseSuggestPmosAddresses = suggestPmosAddresses;

  suggestPmosAddresses = function(query, limit, preferGoogle) {
    const text = String(query || '').trim();
    const maximum = Math.max(1, Math.min(10, Number(limit || 6)));
    if (text.length < 3 || preferGoogle === true) {
      return baseSuggestPmosAddresses(query, limit, preferGoogle);
    }

    const normalized = normalizePmosAddressSearch_(text);
    const cache = CacheService.getScriptCache();
    const prefix = normalized.slice(0, Math.min(8, normalized.length));
    const prefixKey = 'PMOS_ADDRESS_PREFIX_V1_' + pmosAddressCacheDigest_(prefix);
    const cached = cache.get(prefixKey);
    if (cached) {
      try {
        const rows = JSON.parse(cached) || [];
        const filtered = rows.filter(function(item) {
          return normalizePmosAddressSearch_(item && item.address).indexOf(normalized) >= 0;
        });
        if (filtered.length >= Math.min(3, maximum)) return filtered.slice(0, maximum);
      } catch (ignored) {}
    }

    const output = baseSuggestPmosAddresses(query, limit, preferGoogle) || [];
    if (output.length) {
      for (let length = 3; length <= Math.min(8, normalized.length); length++) {
        const key = 'PMOS_ADDRESS_PREFIX_V1_' + pmosAddressCacheDigest_(normalized.slice(0, length));
        cache.put(key, JSON.stringify(output.slice(0, 10)), 1800);
      }
    }
    return output;
  };
})();
