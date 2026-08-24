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

(function () {
  if (typeof savePmosCustomerLifecycleEditorData === 'function') {
    const baseLifecycleSave = savePmosCustomerLifecycleEditorData;
    savePmosCustomerLifecycleEditorData = function(input) {
      const request = Object.assign({}, input || {});
      const rawContacts = Array.isArray(request.accountContacts) ? request.accountContacts : [];
      let removed = [];
      rawContacts.forEach(function(contact) {
        const values = contact && contact.__pmosRemovedResourceNames;
        if (Array.isArray(values)) removed = removed.concat(values);
      });
      removed = removed.map(function(value) { return String(value || '').trim(); }).filter(function(value, index, all) {
        return value && all.indexOf(value) === index;
      });
      const result = baseLifecycleSave(request);
      if (removed.length) {
        const keep = rawContacts.map(function(contact) { return String(contact && contact.resourceName || '').trim(); }).filter(Boolean);
        rawContacts.forEach(function(contact) {
          const primary = String(contact && contact.__pmosPrimaryResourceName || '').trim();
          if (primary && keep.indexOf(primary) < 0) keep.push(primary);
        });
        try {
          const unlink = pmosUnlinkRemovedAccountGoogleResources_(result.customerId || request.customerId, removed, keep);
          if (unlink.removed.length) result.removedAccountContactLinks = unlink.removed;
        } catch (error) {
          result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
          result.warnings.push('Account Contact changes were saved in PMOS, but removed Google Contact links could not be detached from this account: ' +
            String(error && error.message ? error.message : error));
        }
      }
      result.profile = getPmosCustomerLifecycleProfile(result.customerId || request.customerId);
      return result;
    };
  }

  if (typeof pmosAccountContactClientScript_ === 'function') {
    const baseAccountScript = pmosAccountContactClientScript_;
    pmosAccountContactClientScript_ = function() {
      return baseAccountScript() + String.raw`
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
  var baseCollect=typeof pmosCollectAccountContacts==='function'?pmosCollectAccountContacts:null;
  if(baseCollect){
    pmosCollectAccountContacts=function(containerId){
      var contacts=baseCollect.apply(this,arguments)||[],root=document.getElementById(containerId),primary=root&&root.querySelector('.account-contact-primary'),primaryResource=String(primary&&primary.dataset.resourceName||''),removed=(window.__pmosRemovedAccountContactResources[containerId]||[]).slice();
      var metadata={__pmosAccountContactMetadata:true,__pmosPrimaryResourceName:primaryResource,__pmosRemovedResourceNames:removed};
      if(contacts.length){contacts[0].__pmosPrimaryResourceName=primaryResource;contacts[0].__pmosRemovedResourceNames=removed}else if(primaryResource||removed.length){contacts.push(metadata)}
      return contacts;
    };
  }
  window.pmosResetRemovedAccountContacts=function(containerId){window.__pmosRemovedAccountContactResources[containerId]=[]};
})();
`;
    };
  }
})();
