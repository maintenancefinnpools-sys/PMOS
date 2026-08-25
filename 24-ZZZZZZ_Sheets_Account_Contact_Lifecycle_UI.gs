/** Use the same ordered Account Contact lifecycle in the Sheets Customer Editor. */
(function () {
  if (typeof buildPmosCustomerAccountEditorHtml_ === 'function') {
    const baseBuildAccountEditor = buildPmosCustomerAccountEditorHtml_;
    buildPmosCustomerAccountEditorHtml_ = function(customerId, returnContext) {
      let html = baseBuildAccountEditor(customerId, returnContext);
      if (html.indexOf('__pmosSheetsAccountContactLifecycle') >= 0) return html;
      if (typeof pmosAccountContactStyles_ === 'function') {
        html = html.replace('</style>', pmosAccountContactStyles_() +
          '.pmos-sheets-account-contact-host{grid-column:1/-1;display:grid;gap:9px}.pmos-sheets-account-contact-copy{color:#68747a;font-size:10px;line-height:1.45}.pmos-sheets-account-contact-add{justify-self:start;margin:0!important;padding:7px 10px!important;border:1px solid #9db6c1!important;border-radius:7px!important;background:#fff!important;color:#0f5470!important;font-size:10px!important;font-weight:900!important;cursor:pointer}.pmos-sheets-editor-loading>*:not(#pmosSheetsEditorLoading){visibility:hidden!important}#pmosSheetsEditorLoading{display:none;position:fixed;inset:0;z-index:9999;place-items:center;padding:32px;background:#e5eaed;color:#293944;text-align:center}.pmos-sheets-editor-loading #pmosSheetsEditorLoading{display:grid}.pmos-sheets-editor-spinner{width:38px;height:38px;margin:0 auto 13px;border:4px solid #cad8de;border-top-color:#0f5470;border-radius:50%;animation:pmos-sheets-editor-spin .85s linear infinite}#pmosSheetsEditorLoading.error .pmos-sheets-editor-spinner{display:none}#pmosSheetsEditorLoading strong{display:block;font-size:16px}#pmosSheetsEditorLoading span{display:block;max-width:470px;margin-top:7px;color:#68747a;font-size:11px;line-height:1.5;white-space:pre-wrap}@keyframes pmos-sheets-editor-spin{to{transform:rotate(360deg)}}\n</style>');
      }
      const accountScript = typeof pmosAccountContactClientScript_ === 'function'
        ? pmosAccountContactClientScript_() : '';
      html = html.replace('<body>', '<body class="pmos-sheets-editor-loading"><div id="pmosSheetsEditorLoading" role="status" aria-live="polite"><div><div class="pmos-sheets-editor-spinner"></div><strong id="pmosSheetsEditorLoadingTitle">Loading customer…</strong><span id="pmosSheetsEditorLoadingMessage">Preparing account contacts, service location, maintenance, notes, and equipment.</span></div></div>');
      html = html.replace('</script></body></html>', accountScript + String.raw`
(function(){
  if(window.__pmosSheetsAccountContactLifecycle)return;window.__pmosSheetsAccountContactLifecycle=true;
  var hydrated=false,watchTimer=0,loadWarningTimer=0;
  function revealEditor(){hydrated=true;if(watchTimer){clearInterval(watchTimer);watchTimer=0}if(loadWarningTimer){clearTimeout(loadWarningTimer);loadWarningTimer=0}document.body.classList.remove('pmos-sheets-editor-loading');document.body.removeAttribute('aria-busy')}
  function showLoadError(message){var box=document.getElementById('pmosSheetsEditorLoading'),title=document.getElementById('pmosSheetsEditorLoadingTitle'),copy=document.getElementById('pmosSheetsEditorLoadingMessage');if(box)box.classList.add('error');if(title)title.textContent='Customer could not be loaded';if(copy)copy.textContent=message||'Close the editor and try again.'}
  document.body.setAttribute('aria-busy','true');
  var baseSetStatus=typeof window.setStatus==='function'?window.setStatus:null;
  if(baseSetStatus){window.setStatus=function(message,error){var result=baseSetStatus.apply(this,arguments);if(error)showLoadError(message);return result}}
  function setupHost(){
    var legacy=document.getElementById('additionalContacts'),addLegacy=document.getElementById('addContact'),first=document.getElementById('firstName'),last=document.getElementById('lastName'),phone=document.getElementById('phone'),email=document.getElementById('email');
    if(!legacy||!first||!last)return null;
    var section=legacy.closest('.section'),grid=legacy.parentElement,host=document.getElementById('accountContacts');
    if(section){var heading=section.querySelector('.section-head h3');if(heading)heading.textContent='Account Contacts'}
    legacy.style.display='none';if(addLegacy)addLegacy.style.display='none';
    if(!host){
      var wrap=document.createElement('div');wrap.className='pmos-sheets-account-contact-host';wrap.innerHTML='<div class="pmos-sheets-account-contact-copy">The top card is the Primary Account Contact and defines the customer identity. Drag another Account Contact to the top to make that person primary.</div><div id="accountContacts" class="account-contact-list"></div><button id="addAccountContact" type="button" class="pmos-sheets-account-contact-add">+ Add Account Contact</button>';
      grid.insertBefore(wrap,legacy);host=wrap.querySelector('#accountContacts');
      wrap.querySelector('#addAccountContact').onclick=function(){pmosAddAccountContact('accountContacts',{})};
    }
    if(typeof window.pmosMountPrimaryAccountContactCard==='function')window.pmosMountPrimaryAccountContactCard({listId:'accountContacts',lastNameId:'lastName',firstNameId:'firstName',phoneId:'phone',emailId:'email'});
    return host;
  }
  function hydrate(){
    var host=setupHost();if(!host||!window.loaded)return false;
    if(typeof window.pmosResetRemovedAccountContacts==='function')window.pmosResetRemovedAccountContacts('accountContacts');
    if(typeof pmosRenderAccountContacts==='function')pmosRenderAccountContacts('accountContacts',window.loaded.accountContacts||[]);
    setTimeout(revealEditor,0);return true;
  }
  if(typeof window.loadExistingContacts==='function')window.loadExistingContacts=function(){var legacy=document.getElementById('additionalContacts');if(legacy)legacy.innerHTML=''};
  var basePayload=typeof window.payload==='function'?window.payload:null;
  if(basePayload){
    window.payload=function(){
      var data=basePayload.apply(this,arguments)||{};
      data.additionalContacts=[];
      data.accountContacts=typeof pmosCollectAccountContacts==='function'?pmosCollectAccountContacts('accountContacts'):[];
      var primary=document.querySelector('#accountContacts .account-contact-primary');
      data.primaryAccountContactResourceName=String(primary&&primary.dataset.resourceName||'');
      return data;
    };
  }
  function installSave(){
    var save=document.getElementById('save');if(!save||save.dataset.pmosAccountLifecycleSave==='1')return;
    save.dataset.pmosAccountLifecycleSave='1';
    save.onclick=function(){
      var button=this,data=window.payload();button.disabled=true;button.textContent='Saving…';button.classList.remove('saved');button.classList.add('saving');setStatus('Saving account, service location, contacts, equipment and scheduling changes…');
      google.script.run.withSuccessHandler(function(result){
        var warnings=(result&&result.warnings)||[],message='Changes saved successfully';
        if(result&&result.maintenanceTransition==='ENROLLED')message='Saved · Water Maintenance added';
        else if(result&&result.maintenanceTransition==='REMOVED')message='Saved · Water Maintenance removed; Calendar cleanup scheduled';
        else if(result&&result.calendarStatus==='SCHEDULED')message='Saved · Calendar refresh scheduled';
        button.classList.remove('saving');button.classList.add('saved');button.textContent='Saved ✓';setStatus(message+(warnings.length?' · '+warnings.join(' · '):''),warnings.length>0);
        if(warnings.length){button.disabled=false;return}setTimeout(finishReturn,900);
      }).withFailureHandler(function(error){button.disabled=false;button.classList.remove('saving');button.textContent='Save Changes';setStatus(error&&error.message?error.message:String(error),true)}).savePmosCustomerLifecycleEditorData(data);
    };
  }
  function refresh(){setupHost();installSave();if(!hydrated&&window.loaded)hydrate()}
  document.addEventListener('DOMContentLoaded',function(){
    refresh();
    // Server work can legitimately exceed five seconds. Keep watching until the
    // payload arrives so a late success can still reveal the fully hydrated form.
    watchTimer=setInterval(refresh,100);
    loadWarningTimer=setTimeout(function(){
      if(!hydrated)showLoadError('Loading this customer is taking longer than expected. Close the editor and try again; the form has not been changed.');
    },45000);
  });
})();
` + '\n</script></body></html>');
      return html;
    };
  }

  if (typeof pmosAccountContactClientScript_ === 'function') {
    const baseAccountScript = pmosAccountContactClientScript_;
    pmosAccountContactClientScript_ = function() {
      return baseAccountScript() + String.raw`
(function(){
  if(window.__pmosAccountContactRenderReset)return;window.__pmosAccountContactRenderReset=true;
  var baseRender=typeof pmosRenderAccountContacts==='function'?pmosRenderAccountContacts:null;
  if(baseRender){pmosRenderAccountContacts=function(containerId,contacts){if(typeof window.pmosResetRemovedAccountContacts==='function')window.pmosResetRemovedAccountContacts(containerId);return baseRender.apply(this,arguments)}}
})();
`;
    };
  }
})();
