/**
 * Shared Calendar Repair event identity helpers.
 *
 * Repair may need to recognize older PMOS route events that predate current
 * management metadata. Recognition is limited to customers/routes that still
 * exist in the authoritative route template.
 */
function repairRouteIdentityPool_() {
  const identities = {ids:{}, titles:{}};
  readRoutesInPhysicalOrder_().forEach(function(row) {
    if (row.customerId) {
      identities.ids[String(row.customerId).trim()] = true;
    }
    if (row.title) {
      identities.titles[normalize_(row.title)] = true;
    }
  });
  return identities;
}

function repairEventMatchesRoute_(event, identities) {
  const pool = identities || {ids:{}, titles:{}};
  const description = String(event && event.getDescription
    ? event.getDescription() || ''
    : '');
  const idMatch = description.match(/PMOS_CUSTOMER_ID=([^\n]+)/);
  if (
    idMatch &&
    pool.ids &&
    pool.ids[String(idMatch[1]).trim()]
  ) {
    return true;
  }
  return Boolean(
    pool.titles &&
    pool.titles[normalize_(event && event.getTitle ? event.getTitle() : '')]
  );
}
