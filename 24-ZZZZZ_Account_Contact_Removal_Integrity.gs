/** Safely unlink removed Account Contacts from the PMOS account without deleting Google Contacts. */
function pmosUnlinkRemovedAccountGoogleResources_(customerId, removedResourceNames, keepResourceNames) {
  const removed = (removedResourceNames || []).map(function(value) { return String(value || '').trim(); }).filter(Boolean);
  if (!removed.length) return {changed: false, removed: []};
  const keep = (keepResourceNames || []).map(function(value) { return String(value || '').trim(); }).filter(Boolean);
  const customer = getPmosCustomerContactRecord_(customerId, true);
  const actuallyRemoved = removed.filter(function(resourceName) {
    return keep.indexOf(resourceName) < 0 && (customer.resourceNames || []).indexOf(resourceName) >= 0;
  });
  if (!actuallyRemoved.length) return {changed: false, removed: []};
  let resources = (customer.resourceNames || []).filter(function(resourceName) {
    return actuallyRemoved.indexOf(resourceName) < 0;
  });
  let ordered = resources.slice();
  if (resources.length) {
    try {
      const first = People.People.get(resources[0], {personFields: PMOS_CONTACT_FIELDS_});
      ordered = [first].concat(resources.slice(1));
    } catch (ignored) {}
  }
  writePmosGoogleContactLinks_(customer, ordered);
  if (typeof syncPmosAccountSharedCustomerFields_ === 'function') syncPmosAccountSharedCustomerFields_(customerId);
  return {changed: true, removed: actuallyRemoved};
}

function pmosAccountContactRemovalIntegrityScript_() {
  return String.raw`
(function(){
  if(window.__pmosAccountContactRemovalIntegrity)return;window.__pmosAccountContactRemovalIntegrity=true;
  window.__pmosRemovedAccountContactResources=window.__pmosRemovedAccountContactResources||{};
  function rootFor(row){return row&&row.closest&&row.closest('.account-contact-list')}
  document.addEventListener('click',function(event){
    var button=event.target&&event.target.closest&&event.target.closest('.account-contact-remove');if(!button)return;
    var row=button.closest('.account-contact-row');if(!row||row.classList.contains('account-contact-primary'))return;
    var root=rootFor(row),resource=String(row.dataset.resourceName||'');if(!root||!root.id||!resource)return;
    var removed=window.__pmosRemovedAccountContactResources[root.id]||[];if(removed.indexOf(resource)<0)removed.push(resource);window.__pmosRemovedAccountContactResources[root.id]=removed;
  },true);
  window.pmosResetRemovedAccountContacts=function(containerId){window.__pmosRemovedAccountContactResources[containerId]=[]};
})();
`;
}
