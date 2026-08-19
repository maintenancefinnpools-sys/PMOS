/**
 * Integrates Customer Accounts / Service Locations into the normal Customer Lookup flow.
 * Customer Lookup is the single customer entry point; editing and adding service locations
 * are launched from the selected account/profile rather than separate menu searches.
 */
(function () {
  if (typeof showEditCustomerInformationSearch === 'function') {
    showEditCustomerInformationSearch = function() {
      showCustomerLookup();
    };
  }

  if (typeof searchPmosCustomerProfiles === 'function') {
    const baseSearchPmosCustomerProfiles = searchPmosCustomerProfiles;
    searchPmosCustomerProfiles = function(query) {
      const baseRows = baseSearchPmosCustomerProfiles('');
      const byCustomerId = {};
      baseRows.forEach(function(row) {
        byCustomerId[String(row.customerId || '').trim()] = row;
      });

      const accountTable = ensurePmosCustomerAccountIds_();
      const accountIdIndex = findHeaderIndex_(accountTable.headers, ['Account ID']);
      const customerIdIndex = findHeaderIndex_(accountTable.headers, ['Customer ID']);
      const locationNameIndex = findHeaderIndex_(accountTable.headers, ['Service Location Name']);
      const titleIndex = findHeaderIndex_(accountTable.headers, ['Calendar Title']);
      const addressIndex = findHeaderIndex_(accountTable.headers, ['Full Address', 'Service Address', 'Address']);
      const accountTerms = {};
      accountTable.rows.forEach(function(row) {
        const customerId = customerIdIndex >= 0 ? String(row[customerIdIndex] || '').trim() : '';
        if (!customerId) return;
        const accountId = accountIdIndex >= 0 ? String(row[accountIdIndex] || customerId).trim() : customerId;
        if (!accountTerms[accountId]) accountTerms[accountId] = [];
        [locationNameIndex, titleIndex, addressIndex].forEach(function(index) {
          if (index >= 0 && String(row[index] || '').trim()) accountTerms[accountId].push(String(row[index]).trim());
        });
      });

      const cleanQuery = normalizePmosCustomerSearch_(query);
      return listPmosCustomerAccountsForServiceLocations('').map(function(account) {
        const primary = byCustomerId[account.customerId] || {};
        const locationCount = Number(account.serviceLocationCount || 1);
        return {
          customerId: account.customerId,
          displayName: primary.displayName || account.displayName,
          listName: account.listName || primary.listName,
          calendarTitle: primary.calendarTitle || '',
          address: primary.address || account.address,
          phone: primary.phone || account.phone,
          email: primary.email || '',
          status: primary.status || 'Active',
          serviceLocationCount: locationCount,
          sidebarMeta: locationCount > 1 ? locationCount + ' service locations' : '',
          accountSearchText: normalizePmosCustomerSearch_([
            primary.displayName, account.listName, primary.phone, primary.email,
            account.address, account.phone, (accountTerms[account.accountId] || []).join(' ')
          ].join(' '))
        };
      }).filter(function(row) {
        return !cleanQuery || row.accountSearchText.indexOf(cleanQuery) >= 0;
      }).sort(function(left, right) {
        return String(left.listName || left.displayName || '').localeCompare(
          String(right.listName || right.displayName || '')
        ) || String(left.customerId).localeCompare(String(right.customerId));
      });
    };
  }

  if (typeof getPmosCustomerProfile === 'function') {
    const baseGetPmosCustomerProfile = getPmosCustomerProfile;
    getPmosCustomerProfile = function(customerId) {
      const profile = baseGetPmosCustomerProfile(customerId);
      const account = getPmosCustomerAccount_(customerId);
      const primary = account.locations.filter(function(location) { return location.primary; })[0] || account.locations[0] || null;
      const selected = account.locations.filter(function(location) {
        return String(location.customerId) === String(profile.customerId);
      })[0] || null;
      profile.accountId = account.accountId;
      profile.accountName = account.accountName;
      profile.accountPrimaryCustomerId = primary ? primary.customerId : profile.customerId;
      profile.serviceLocations = account.locations;
      profile.selectedServiceLocation = selected;
      profile.locationName = selected ? (selected.locationName || selected.calendarTitle || '') : '';
      profile.isPrimaryServiceLocation = selected ? selected.primary : true;
      return profile;
    };
  }

  if (typeof buildPmosCustomerLookupHtml_ === 'function') {
    const baseBuildPmosCustomerLookupHtml = buildPmosCustomerLookupHtml_;
    buildPmosCustomerLookupHtml_ = function(mode, initialCustomerId) {
      let html = baseBuildPmosCustomerLookupHtml('LOOKUP', initialCustomerId);
      html = html.replace(
        '<button id="edit" class="edit">Edit Customer</button>',
        '<div class="profile-actions"><button id="addServiceLocation" class="profile-secondary" type="button">+ Add Service Location</button><button id="edit" class="edit" type="button">Edit Location</button></div>'
      );
      html = html.replace(
        '</style>',
        '.profile-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}.profile-secondary{padding:10px 14px;border:1px solid #0f5470;border-radius:7px;background:#fff;color:#0f5470;font:inherit;font-weight:900;cursor:pointer}.profile-secondary:hover{background:#eaf5f9}.service-location-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 2px 9px}.service-location-head h3{margin:0;font-size:19px;font-weight:900}.service-location-hint{color:#758289;font-size:10px}.service-location-grid{display:grid;gap:8px}.service-location-card{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(100px,.55fr) minmax(86px,.45fr);align-items:center;gap:12px;width:100%;padding:12px 14px;border:1px solid #d2dade;border-left:4px solid #9cb0b9;border-radius:9px;background:#f9fafb;color:#293944;text-align:left;cursor:pointer}.service-location-card:hover{background:#edf5f8;border-left-color:#4e8aa3}.service-location-card.selected{border-color:#8fc4da;border-left-color:#017db1;background:#eaf6fb}.service-location-name{font-size:12px;font-weight:900}.service-location-address{margin-top:3px;color:#68747a;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.service-location-meta{font-size:10px;color:#68747a}.service-location-meta b{display:block;margin-top:2px;color:#293944;font-size:11px}.primary-location-badge{display:inline-block;margin-left:6px;padding:2px 6px;border-radius:999px;background:#dcefdc;color:#356443;font-size:8px;font-weight:900;text-transform:uppercase}@media(max-width:820px){.profile-actions{justify-content:flex-start}.service-location-card{grid-template-columns:1fr}}\n</style>'
      );
      html = html.replace(
        '</script></body></html>',
        `
var baseAccountResolveSearchMatch=resolveSearchMatch;
resolveSearchMatch=function(query){var clean=normalizeSearch(query);if(clean){var accountMatch=allRows.find(function(row){return String(row.accountSearchText||'').indexOf(clean)>=0});if(accountMatch)return accountMatch}return baseAccountResolveSearchMatch(query)};
var baseAccountRenderResults=renderResults;
renderResults=function(rows){baseAccountRenderResults(rows);(rows||[]).forEach(function(row){if(!row.sidebarMeta)return;var button=customerButton(row.customerId),meta=button&&button.querySelector('.result-meta');if(meta)meta.textContent=[meta.textContent,row.sidebarMeta].filter(Boolean).join(' · ')})};
var baseAccountRenderProfile=renderProfile;
renderProfile=function(profile){
  baseAccountRenderProfile(profile);
  var locations=profile.serviceLocations||[],selected=profile.selectedServiceLocation||{},block='';
  el('profileName').textContent=profile.accountName||profile.displayName;
  el('avatar').textContent=initials(profile.accountName||profile.displayName);
  if(locations.length){
    block='<div class="service-location-head"><div><h3>Service locations</h3><div class="service-location-hint">Select a property to view its schedule, notes and equipment.</div></div></div><div class="service-location-grid">'+locations.map(function(location){var chosen=String(location.customerId)===String(profile.customerId),name=location.locationName||location.calendarTitle||'Service Location',primary=location.primary?'<span class="primary-location-badge">Primary</span>':'';return '<button type="button" class="service-location-card'+(chosen?' selected':'')+'" data-location-id="'+esc(location.customerId)+'"><div><div class="service-location-name">'+esc(name)+primary+'</div><div class="service-location-address">'+esc(location.address||'')+'</div></div><div class="service-location-meta">Frequency<b>'+esc(String(location.frequency||'').replace(/^Biweekly$/i,'Bi-Weekly')||'—')+'</b></div><div class="service-location-meta">Status<b>'+esc(location.status||'Active')+'</b></div></button>'}).join('')+'</div>';
    el('content').insertAdjacentHTML('afterbegin','<div id="accountServiceLocations">'+block+'</div>');
    Array.prototype.forEach.call(el('accountServiceLocations').querySelectorAll('.service-location-card'),function(button){button.onclick=function(){selectAccountServiceLocation(this.dataset.locationId)}});
  }
  el('profileSubtitle').textContent=selected&&selected.locationName?(selected.primary?'Primary · ':'')+selected.locationName:(profile.calendarTitle&&profile.calendarTitle!==profile.displayName?'Calendar: '+profile.calendarTitle:'');
  el('edit').textContent='Edit Location';
  markSelected(profile.accountPrimaryCustomerId||profile.customerId);
  setCursor(profile.accountPrimaryCustomerId||profile.customerId);
};
function selectAccountServiceLocation(customerId){if(!customerId||String(customerId)===String(selectedId))return;selectedId=customerId;el('profile').style.display='none';google.script.run.withSuccessHandler(renderProfile).withFailureHandler(showError).getPmosCustomerProfile(customerId)}
var addLocationButton=el('addServiceLocation');if(addLocationButton)addLocationButton.addEventListener('click',function(){if(!selectedId)return;this.disabled=true;google.script.run.withSuccessHandler(function(){setTimeout(function(){google.script.host.close()},250)}).withFailureHandler(function(error){addLocationButton.disabled=false;showError(error)}).showPmosAddServiceLocation(selectedId)});
</script></body></html>`
      );
      return html;
    };
  }

  if (typeof buildPmosCustomerEditorHtml_ === 'function') {
    const baseBuildPmosCustomerEditorHtml = buildPmosCustomerEditorHtml_;
    buildPmosCustomerEditorHtml_ = function(customerId, returnContext) {
      let html = baseBuildPmosCustomerEditorHtml(customerId, returnContext);
      const idJson = JSON.stringify(String(customerId || ''));
      html = html.replace(
        '<div class="section"><div class="section-head"><h3>Maintenance</h3>',
        '<div style="display:flex;justify-content:flex-end;margin:0 0 10px"><button id="addServiceLocationFromEditor" type="button" class="route-change">+ Add Service Location</button></div><div class="section"><div class="section-head"><h3>Maintenance</h3>'
      );
      html = html.replace(
        '</script></body></html>',
        `
var addServiceLocationFromEditor=document.getElementById('addServiceLocationFromEditor');if(addServiceLocationFromEditor)addServiceLocationFromEditor.onclick=function(){this.disabled=true;google.script.run.withSuccessHandler(function(){setTimeout(function(){google.script.host.close()},250)}).withFailureHandler(function(error){addServiceLocationFromEditor.disabled=false;alert(error&&error.message?error.message:String(error))}).showPmosAddServiceLocation(${idJson})};
</script></body></html>`
      );
      return html;
    };
  }
})();

function showPmosAddServiceLocation(customerId) {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('Select a customer before adding a service location.');
  let htmlText = buildPmosServiceLocationManagerHtml_(id);
  htmlText = htmlText.replace(
    'if(data.locations.length)showLocation(data.locations[0])',
    'showAdd()'
  );
  const html = HtmlService.createHtmlOutput(htmlText).setWidth(980).setHeight(820);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Add Service Location');
}
