/**
 * Preserve Google Contact identity when Account Contacts are reordered.
 *
 * PMOS remains authoritative for the ordered people data. This layer only carries the
 * existing Google People resource association with the person being promoted/demoted,
 * then makes the promoted linked person the first account Google-resource link.
 */

function pmosPrimaryAccountGoogleResourceName_(customerId) {
  try {
    const record = getPmosCustomerContactRecord_(customerId, false);
    return String(record.resourceName || (record.resourceNames || [])[0] || '').trim();
  } catch (ignored) {
    return '';
  }
}

function pmosReorderAccountGoogleResources_(customerId, requestedPrimaryResourceName) {
  const requested = String(requestedPrimaryResourceName || '').trim();
  if (!requested) return {changed: false, resourceName: ''};
  const customer = getPmosCustomerContactRecord_(customerId, true);
  const resources = (customer.resourceNames || []).slice();
  const index = resources.indexOf(requested);
  if (index < 0) {
    return {
      changed: false,
      resourceName: customer.resourceName || '',
      warning: 'The promoted Account Contact is no longer linked to the expected Google Contact. PMOS contact order was saved, but the Google primary link was left unchanged.'
    };
  }
  if (index === 0 && String(customer.resourceName || '') === requested) {
    return {changed: false, resourceName: requested};
  }
  resources.splice(index, 1);
  resources.unshift(requested);
  let ordered = resources.slice();
  try {
    const first = People.People.get(requested, {personFields: PMOS_CONTACT_FIELDS_});
    ordered = [first].concat(resources.slice(1));
  } catch (ignored) {}
  writePmosGoogleContactLinks_(customer, ordered);
  if (typeof syncPmosAccountSharedCustomerFields_ === 'function') {
    syncPmosAccountSharedCustomerFields_(customerId);
  }
  return {changed: true, resourceName: requested};
}

(function () {
  if (typeof pmosCustomerPrimaryAccountContact_ === 'function') {
    const basePrimaryContact = pmosCustomerPrimaryAccountContact_;
    pmosCustomerPrimaryAccountContact_ = function(customerId) {
      const contact = basePrimaryContact(customerId);
      contact.resourceName = pmosPrimaryAccountGoogleResourceName_(customerId);
      return contact;
    };
  }

  if (typeof savePmosCustomerLifecycleEditorData === 'function') {
    const baseLifecycleSave = savePmosCustomerLifecycleEditorData;
    savePmosCustomerLifecycleEditorData = function(input) {
      const request = Object.assign({}, input || {});
      const rawContacts = Array.isArray(request.accountContacts) ? request.accountContacts : [];
      let requestedPrimaryResourceName = String(request.primaryAccountContactResourceName || '').trim();
      if (!requestedPrimaryResourceName && rawContacts.length) {
        requestedPrimaryResourceName = String(rawContacts[0] && rawContacts[0].__pmosPrimaryResourceName || '').trim();
      }
      const result = baseLifecycleSave(request);
      if (requestedPrimaryResourceName) {
        try {
          const reorder = pmosReorderAccountGoogleResources_(result.customerId || request.customerId, requestedPrimaryResourceName);
          if (reorder.warning) {
            result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
            result.warnings.push(reorder.warning);
          }
        } catch (error) {
          result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
          result.warnings.push('Account Contact order was saved in PMOS, but the Google Contact primary-link order could not be updated: ' +
            String(error && error.message ? error.message : error));
        }
      }
      result.profile = getPmosCustomerLifecycleProfile(result.customerId || request.customerId);
      return result;
    };
  }

  if (typeof pmosAccountContactClientScript_ === 'function') {
    const baseAccountContactScript = pmosAccountContactClientScript_;
    pmosAccountContactClientScript_ = function() {
      return baseAccountContactScript() + String.raw`
(function(){
  if(window.__pmosPrimaryContactLinkIntegrity)return;window.__pmosPrimaryContactLinkIntegrity=true;
  var dragSnapshot=null;
  function primaryRow(root){return root&&root.querySelector('.account-contact-primary')}
  function resource(row){return row&&String(row.dataset.resourceName||'')||''}
  function setPrimaryResource(root,value){var primary=primaryRow(root);if(primary)primary.dataset.resourceName=String(value||'')}

  if(typeof window.pmosMountPrimaryAccountContactCard==='function'){
    var baseMount=window.pmosMountPrimaryAccountContactCard;
    window.pmosMountPrimaryAccountContactCard=function(config){
      var result=baseMount.apply(this,arguments),root=document.getElementById(config&&config.listId),primary=primaryRow(root);
      if(primary&&!primary.dataset.resourceName)primary.dataset.resourceName='';
      return result;
    };
  }

  if(typeof pmosRenderAccountContacts==='function'){
    var baseRender=pmosRenderAccountContacts;
    pmosRenderAccountContacts=function(containerId,contacts){
      var result=baseRender.apply(this,arguments),root=document.getElementById(containerId),rows=contacts||[],primaryResource='';
      if(rows.length)primaryResource=String(rows[0]&&rows[0].__pmosPrimaryResourceName||'');
      if(!primaryResource&&window.__pmosAccountPrimaryResourceByList)primaryResource=window.__pmosAccountPrimaryResourceByList[containerId]||'';
      setPrimaryResource(root,primaryResource);
      return result;
    };
  }

  document.addEventListener('dragstart',function(event){
    var row=event.target&&event.target.closest&&event.target.closest('.account-contact-row');if(!row)return;
    var root=row.parentElement,primary=primaryRow(root);if(!primary)return;
    dragSnapshot={row:row,root:root,draggedResource:resource(row),primaryResource:resource(primary),primary:primary};
  },true);
  document.addEventListener('drop',function(event){
    if(!dragSnapshot)return;var target=event.target&&event.target.closest&&event.target.closest('.account-contact-row'),snap=dragSnapshot;
    if(!target||target.parentElement!==snap.root){dragSnapshot=null;return}
    var promote=(target===snap.primary&&snap.row!==snap.primary)||(snap.row===snap.primary&&target!==snap.primary);
    if(!promote){dragSnapshot=null;return}
    var promotedResource=snap.row===snap.primary?resource(target):snap.draggedResource;
    var demotedResource=snap.primaryResource,demotedRow=snap.row===snap.primary?target:snap.row;
    setTimeout(function(){setPrimaryResource(snap.root,promotedResource);if(demotedRow)demotedRow.dataset.resourceName=String(demotedResource||'');},0);
    dragSnapshot=null;
  },true);

  var baseCollect=typeof pmosCollectAccountContacts==='function'?pmosCollectAccountContacts:null;
  if(baseCollect){
    pmosCollectAccountContacts=function(containerId){
      var contacts=baseCollect.apply(this,arguments)||[],root=document.getElementById(containerId),primary=primaryRow(root),primaryResource=resource(primary);
      contacts.forEach(function(contact){contact.__pmosPrimaryResourceName=primaryResource});
      return contacts;
    };
  }
})();
`;
    };
  }
})();
