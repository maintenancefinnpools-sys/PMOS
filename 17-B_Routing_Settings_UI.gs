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
  const optimization = normalizePmosRiePreference_(values.optimization);
  const preset = PMOS_RIE_WEIGHT_PRESETS[optimization] || PMOS_RIE_WEIGHT_PRESETS.BALANCED;
  const weights = normalizePmosRieRankingWeights_(values.rankingWeights, preset);
  updates[PMOS_RIE_PROPERTIES.OPTIMIZATION] = optimization;
  updates[PMOS_RIE_PROPERTIES.WEIGHT_ROUTE] = String(weights.route);
  updates[PMOS_RIE_PROPERTIES.WEIGHT_STOPS] = String(weights.stops);
  updates[PMOS_RIE_PROPERTIES.WEIGHT_ADDED_TIME] = String(weights.addedTime);
  updates[PMOS_RIE_PROPERTIES.WEIGHT_ADDED_DISTANCE] = String(weights.addedDistance);
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
*{box-sizing:border-box}body{font:13px Arial,sans-serif;color:#293944;background:#e5eaed;margin:0;padding:20px}h2{margin:0 0 5px;color:#0f5470}.muted{color:#68747a;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:18px}label{display:flex;flex-direction:column;gap:5px;font-weight:700}input,select{padding:9px;border:1px solid #cbd5e1;border-radius:7px;background:#fff}.full{grid-column:1/-1}.panel{padding:11px;background:#f9fafb;border:1px solid #d2dade;border-radius:8px}.weights{display:grid;gap:13px;margin-top:12px}.weight-row{display:grid;grid-template-columns:150px 1fr 52px;align-items:center;gap:10px}.weight-label{font-weight:700}.weight-value{text-align:right;font-weight:800;color:#0f5470}.weight-row input[type=range]{width:100%;padding:0;accent-color:#0f5470}.weight-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.total{font-weight:800;color:#0f5470}.buttons{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}button{border:0;border-radius:8px;padding:9px 13px;font-weight:700;cursor:pointer}.primary{background:#0f5470;color:#fff}.secondary{background:#dfe7ea;color:#293944}.danger{background:#f7dddd;color:#8b3030}.status{white-space:pre-wrap;margin-top:12px;padding:10px;background:#f9fafb;border:1px solid #d2dade;border-radius:8px}</style></head><body>
<h2>Routing Settings</h2><div class="muted">Route Intelligence Engine settings used by Create Client and future PMOS routing tools.</div>
<div class="grid"><label>Routing provider<select id="provider"><option value="GRAPHHOPPER">GraphHopper</option><option value="GOOGLE">Google Maps</option></select></label><label>Vehicle profile<input value="Car (suitable for Ford F-150)" disabled></label>
<label class="full">GraphHopper API key<input id="apiKey" type="password" autocomplete="new-password" placeholder="Leave blank to keep the saved key"></label><div id="keyStatus" class="panel full"></div>
<label>Route start<select id="startMode"><option value="SHOP">Shop</option><option value="LAST_STOP">Last stop</option><option value="CUSTOM">Custom address</option></select></label><label>Start address<input id="startAddress" placeholder="Required only for Custom"></label>
<label>Route finish<select id="finishMode"><option value="SHOP">Shop</option><option value="LAST_STOP">Last stop</option><option value="CUSTOM">Custom address</option></select></label><label>Finish address<input id="finishAddress" placeholder="Required only for Custom"></label>
<label>Optimization preference<select id="optimization"><option value="BALANCED">Balanced</option><option value="TIME">Shortest driving time</option><option value="DISTANCE">Shortest distance</option><option value="CUSTOM">Custom</option></select></label><label>Average visit (minutes)<input id="serviceMinutes" type="number" min="0" max="240"></label>
<div class="panel full"><div class="weight-head"><div><b>Recommendation mix</b><div class="muted">Adjust how PMOS chooses the best day or rotation. Exact stop insertion remains optimized separately.</div></div><div id="total" class="total">100%</div></div>
<div class="weights">
<div class="weight-row"><span class="weight-label">Estimated route</span><input id="weightRoute" type="range" min="0" max="100" step="1"><span id="weightRouteValue" class="weight-value"></span></div>
<div class="weight-row"><span class="weight-label">Stop load</span><input id="weightStops" type="range" min="0" max="100" step="1"><span id="weightStopsValue" class="weight-value"></span></div>
<div class="weight-row"><span class="weight-label">Added drive time</span><input id="weightAddedTime" type="range" min="0" max="100" step="1"><span id="weightAddedTimeValue" class="weight-value"></span></div>
<div class="weight-row"><span class="weight-label">Added distance</span><input id="weightAddedDistance" type="range" min="0" max="100" step="1"><span id="weightAddedDistanceValue" class="weight-value"></span></div>
</div></div>
<label>Route cache (days)<input id="cacheDays" type="number" min="1" max="365"></label><div class="panel"><b>Fallback</b><br><span class="muted">Automatic alternate road provider. No straight-line result is presented as GPS routing.</span></div></div>
<div class="buttons"><button id="save" class="primary">Save</button><button id="test" class="secondary">Save & Test</button><button id="clear" class="danger">Clear API Key</button><button id="close" class="secondary">Close</button></div><div id="status" class="status">Loading…</div>
<script>
var presets={BALANCED:{route:50,stops:40,addedTime:6,addedDistance:4},TIME:{route:55,stops:10,addedTime:30,addedDistance:5},DISTANCE:{route:20,stops:5,addedTime:5,addedDistance:70}};
var weightIds={route:'weightRoute',stops:'weightStops',addedTime:'weightAddedTime',addedDistance:'weightAddedDistance'};
function id(x){return document.getElementById(x)}
function readWeights(){var out={};Object.keys(weightIds).forEach(function(k){out[k]=Number(id(weightIds[k]).value)});return out}
function renderWeights(){var w=readWeights(),total=0;Object.keys(weightIds).forEach(function(k){total+=w[k];id(weightIds[k]+'Value').textContent=w[k]+'%'});id('total').textContent=total+'%'}
function setWeights(w){Object.keys(weightIds).forEach(function(k){id(weightIds[k]).value=Number(w[k]||0)});renderWeights()}
function rebalance(changedKey){
 var weights=readWeights(),target=Math.max(0,Math.min(100,weights[changedKey])),keys=Object.keys(weightIds).filter(function(k){return k!==changedKey}),remaining=100-target,otherTotal=keys.reduce(function(sum,k){return sum+weights[k]},0),allocated=0,fractions=[];
 keys.forEach(function(k,index){var raw=otherTotal>0?weights[k]*remaining/otherTotal:remaining/keys.length;var whole=Math.floor(raw);weights[k]=whole;allocated+=whole;fractions.push({key:k,fraction:raw-whole,index:index})});
 fractions.sort(function(a,b){return b.fraction-a.fraction||a.index-b.index});
 for(var i=0;i<remaining-allocated;i++)weights[fractions[i%fractions.length].key]++;
 weights[changedKey]=target;setWeights(weights);id('optimization').value='CUSTOM'
}
function values(){return{provider:id('provider').value,graphHopperApiKey:id('apiKey').value,startMode:id('startMode').value,startAddress:id('startAddress').value,finishMode:id('finishMode').value,finishAddress:id('finishAddress').value,optimization:id('optimization').value,rankingWeights:readWeights(),serviceMinutes:id('serviceMinutes').value,cacheDays:id('cacheDays').value}}
function apply(s){id('provider').value=s.provider;id('startMode').value=s.startMode;id('startAddress').value=s.startAddress;id('finishMode').value=s.finishMode;id('finishAddress').value=s.finishAddress;id('optimization').value=s.optimization;id('serviceMinutes').value=s.serviceMinutes;id('cacheDays').value=s.cacheDays;setWeights(s.rankingWeights);id('keyStatus').textContent=s.graphHopperConfigured?'GraphHopper key configured ••••'+s.graphHopperKeySuffix:'GraphHopper key not configured';id('status').textContent='Ready.'}
Object.keys(weightIds).forEach(function(k){id(weightIds[k]).addEventListener('input',function(){rebalance(k)})});
id('optimization').onchange=function(){var selected=id('optimization').value;if(presets[selected])setWeights(presets[selected])};
function fail(e){id('status').textContent=e&&e.message?e.message:String(e)}
id('save').onclick=function(){id('status').textContent='Saving…';google.script.run.withSuccessHandler(function(){google.script.host.close()}).withFailureHandler(fail).savePmosRieSettings(values())};
id('test').onclick=function(){id('status').textContent='Testing the selected provider…';google.script.run.withSuccessHandler(function(r){id('apiKey').value='';id('status').textContent=r.message+'\\n'+r.distanceKm.toFixed(1)+' km • '+r.durationMinutes.toFixed(0)+' min';google.script.run.withSuccessHandler(apply).getPmosRieSettingsForUi()}).withFailureHandler(fail).testPmosRieProvider(values())};
id('clear').onclick=function(){if(!confirm('Remove the saved GraphHopper API key?'))return;google.script.run.withSuccessHandler(apply).withFailureHandler(fail).clearPmosGraphHopperApiKey()};
id('close').onclick=function(){google.script.host.close()};
google.script.run.withSuccessHandler(apply).withFailureHandler(fail).getPmosRieSettingsForUi();
</script></body></html>`).setWidth(760).setHeight(790);
  SpreadsheetApp.getUi().showModelessDialog(html, 'PMOS Routing Settings');
}
