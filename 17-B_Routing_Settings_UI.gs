/** Secure Routing Settings dialog. API keys never leave Script Properties after submission. */
function getPmosRieSettingsForUi() {
  return getPmosRieSettings_();
}

function savePmosRieSettings(input) {
  const values = input || {};
  const properties = PropertiesService.getScriptProperties();
  const provider = normalizePmosRieProvider_(values.provider);
  const startMode = normalizePmosRieEndpointMode_(values.startMode);
  const finishMode = normalizePmosRieEndpointMode_(values.finishMode);
  const apiKey = String(values.graphHopperApiKey || '').trim();
  if (provider === 'GRAPHHOPPER' && !apiKey &&
      !properties.getProperty(PMOS_RIE_PROPERTIES.GRAPHHOPPER_KEY)) {
    throw new Error('Enter the GraphHopper API key before selecting GraphHopper.');
  }
  if (startMode === 'CUSTOM' && !String(values.startAddress || '').trim()) {
    throw new Error('Enter the custom route start address.');
  }
  if (finishMode === 'CUSTOM' && !String(values.finishAddress || '').trim()) {
    throw new Error('Enter the custom route finish address.');
  }
  const updates = {};
  updates[PMOS_RIE_PROPERTIES.PROVIDER] = provider;
  updates[PMOS_RIE_PROPERTIES.CACHE_DAYS] = String(clampPmosRieNumber_(values.cacheDays, 1, 365, 30));
  updates[PMOS_RIE_PROPERTIES.START_MODE] = startMode;
  updates[PMOS_RIE_PROPERTIES.START_ADDRESS] = String(values.startAddress || '').trim();
  updates[PMOS_RIE_PROPERTIES.FINISH_MODE] = finishMode;
  updates[PMOS_RIE_PROPERTIES.FINISH_ADDRESS] = String(values.finishAddress || '').trim();
  updates[PMOS_RIE_PROPERTIES.OPTIMIZATION] = normalizePmosRiePreference_(values.optimization);
  updates[PMOS_RIE_PROPERTIES.SERVICE_MINUTES] = String(clampPmosRieNumber_(values.serviceMinutes, 0, 240, 20));
  properties.setProperties(updates, false);
  if (apiKey) properties.setProperty(PMOS_RIE_PROPERTIES.GRAPHHOPPER_KEY, apiKey);
  return getPmosRieSettings_();
}

function clearPmosGraphHopperApiKey() {
  PropertiesService.getScriptProperties().deleteProperty(PMOS_RIE_PROPERTIES.GRAPHHOPPER_KEY);
  return getPmosRieSettings_();
}

function testPmosRieProvider(input) {
  if (input) savePmosRieSettings(input);
  const result = routePmosWithRie_([
    {lat: 43.2557, lng: -79.8711},
    {lat: 43.1594, lng: -79.2469}
  ], {allowFallback: false});
  return {
    provider: result.provider,
    distanceKm: result.distanceKm,
    durationMinutes: result.durationMinutes,
    message: result.providerLabel + ' connected successfully.'
  };
}

function showPmosRoutingSettings() {
  const html = HtmlService.createHtmlOutput(`<!doctype html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{font:13px Arial,sans-serif;color:#1f2937;margin:0;padding:20px}h2{margin:0 0 5px}.muted{color:#64748b;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:18px}label{display:flex;flex-direction:column;gap:5px;font-weight:700}input,select{padding:9px;border:1px solid #cbd5e1;border-radius:7px}.full{grid-column:1/-1}.panel{padding:11px;background:#f1f5f9;border-radius:8px}.buttons{display:flex;gap:8px;margin-top:18px}button{border:0;border-radius:8px;padding:9px 13px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e2e8f0}.danger{background:#fee2e2;color:#991b1b}.status{white-space:pre-wrap;margin-top:12px;padding:10px;background:#eff6ff;border-radius:8px}</style></head><body>
<h2>Routing Settings</h2><div class="muted">Route Intelligence Engine settings used by Create Client and future PMOS routing tools.</div>
<div class="grid"><label>Routing provider<select id="provider"><option value="GRAPHHOPPER">GraphHopper</option><option value="GOOGLE">Google Maps</option></select></label><label>Vehicle profile<input value="Car (suitable for Ford F-150)" disabled></label>
<label class="full">GraphHopper API key<input id="apiKey" type="password" autocomplete="new-password" placeholder="Leave blank to keep the saved key"></label><div id="keyStatus" class="panel full"></div>
<label>Route start<select id="startMode"><option value="SHOP">Shop</option><option value="LAST_STOP">Last stop</option><option value="CUSTOM">Custom address</option></select></label><label>Start address<input id="startAddress" placeholder="Required only for Custom"></label>
<label>Route finish<select id="finishMode"><option value="SHOP">Shop</option><option value="LAST_STOP">Last stop</option><option value="CUSTOM">Custom address</option></select></label><label>Finish address<input id="finishAddress" placeholder="Required only for Custom"></label>
<label>Optimization preference<select id="optimization"><option value="BALANCED">Balanced</option><option value="TIME">Shortest driving time</option><option value="DISTANCE">Shortest distance</option></select></label><label>Average visit (minutes)<input id="serviceMinutes" type="number" min="0" max="240"></label>
<label>Route cache (days)<input id="cacheDays" type="number" min="1" max="365"></label><div class="panel"><b>Fallback</b><br><span class="muted">Automatic alternate road provider. No straight-line result is presented as GPS routing.</span></div></div>
<div class="buttons"><button id="save" class="primary">Save</button><button id="test" class="secondary">Save & Test</button><button id="clear" class="danger">Clear API Key</button><button id="close" class="secondary">Close</button></div><div id="status" class="status">Loading…</div>
<script>function id(x){return document.getElementById(x)}function values(){return{provider:id('provider').value,graphHopperApiKey:id('apiKey').value,startMode:id('startMode').value,startAddress:id('startAddress').value,finishMode:id('finishMode').value,finishAddress:id('finishAddress').value,optimization:id('optimization').value,serviceMinutes:id('serviceMinutes').value,cacheDays:id('cacheDays').value}}function apply(s){id('provider').value=s.provider;id('startMode').value=s.startMode;id('startAddress').value=s.startAddress;id('finishMode').value=s.finishMode;id('finishAddress').value=s.finishAddress;id('optimization').value=s.optimization;id('serviceMinutes').value=s.serviceMinutes;id('cacheDays').value=s.cacheDays;id('keyStatus').textContent=s.graphHopperConfigured?'GraphHopper key configured ••••'+s.graphHopperKeySuffix:'GraphHopper key not configured';id('status').textContent='Ready.'}function fail(e){id('status').textContent=e&&e.message?e.message:String(e)}id('save').onclick=function(){id('status').textContent='Saving…';google.script.run.withSuccessHandler(function(s){apply(s);id('apiKey').value='';id('status').textContent='Routing settings saved.'}).withFailureHandler(fail).savePmosRieSettings(values())};id('test').onclick=function(){id('status').textContent='Testing the selected provider…';google.script.run.withSuccessHandler(function(r){id('apiKey').value='';id('status').textContent=r.message+'\\n'+r.distanceKm.toFixed(1)+' km • '+r.durationMinutes.toFixed(0)+' min';google.script.run.withSuccessHandler(apply).getPmosRieSettingsForUi()}).withFailureHandler(fail).testPmosRieProvider(values())};id('clear').onclick=function(){if(!confirm('Remove the saved GraphHopper API key?'))return;google.script.run.withSuccessHandler(apply).withFailureHandler(fail).clearPmosGraphHopperApiKey()};id('close').onclick=function(){google.script.host.close()};google.script.run.withSuccessHandler(apply).withFailureHandler(fail).getPmosRieSettingsForUi();</script></body></html>`).setWidth(720).setHeight(660);
  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Routing Settings');
}
