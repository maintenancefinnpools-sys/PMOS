/**
 * Service-location-specific customer notes for task-focused field reporting.
 *
 * Customer Notes remains the physical compatibility field for General Notes.
 * The four additional note types receive their own Customers columns so future
 * Maintenance, Opening and Closing reports can request only relevant context.
 */
const PMOS_CUSTOMER_CONTEXT_NOTE_HEADERS_ = [
  'Equipment Notes',
  'Maintenance Notes',
  'Opening Notes',
  'Closing Notes'
];

/**
 * Older compatibility forms temporarily stored categorized notes inside Customer Notes.
 * Read that envelope defensively so it can never leak into a profile or editor as text.
 * This is read-only normalization; the spreadsheet remains the source of truth.
 */
function normalizePmosStoredContextNotes_(input) {
  const result = Object.assign({
    generalNotes: '',
    equipmentNotes: '',
    maintenanceNotes: '',
    openingNotes: '',
    closingNotes: ''
  }, input || {});
  let raw = String(result.generalNotes || '');
  for (let depth = 0; depth < 3; depth++) {
    if (raw.indexOf('PMOS_MAINT_CONTACTS_V1:') === 0) {
      try {
        const contacts = JSON.parse(decodeURIComponent(raw.slice('PMOS_MAINT_CONTACTS_V1:'.length)));
        raw = String(contacts.notes || '');
        continue;
      } catch (ignored) { break; }
    }
    if (raw.indexOf('PMOS_CONTEXT_NOTES_V1:') === 0) {
      try {
        const notes = JSON.parse(decodeURIComponent(raw.slice('PMOS_CONTEXT_NOTES_V1:'.length)));
        result.generalNotes = String(notes.generalNotes || '');
        ['equipmentNotes', 'maintenanceNotes', 'openingNotes', 'closingNotes'].forEach(function(key) {
          if (!String(result[key] || '').trim()) result[key] = String(notes[key] || '');
        });
        raw = result.generalNotes;
        continue;
      } catch (ignored) { break; }
    }
    result.generalNotes = raw;
    break;
  }
  if (/^PMOS_(?:CONTEXT_NOTES|MAINT_CONTACTS)_V1:/.test(String(result.generalNotes || ''))) {
    result.generalNotes = '';
  }
  return result;
}

function ensurePmosCustomerContextNotesTable_() {
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [
    PMOS.CUSTOMERS_SHEET, 'Customers', 'Customer Database', 'Customer List'
  ]);
  if (!sheet) throw new Error('Customers sheet was not found.');
  let table = readPmosHeaderTable_(sheet);
  ensureMaintenanceClientHeaders_(sheet, table, PMOS_CUSTOMER_CONTEXT_NOTE_HEADERS_);
  table = readPmosHeaderTable_(sheet);
  return {sheet: sheet, table: table};
}

function getPmosCustomerContextNotes_(customerId) {
  const record = getPmosCustomerEditorRow_(customerId);
  function value(aliases) {
    const index = findHeaderIndex_(record.headers, aliases);
    return index >= 0 ? String(record.values[index] || '').trim() : '';
  }
  return normalizePmosStoredContextNotes_({
    generalNotes: value(['Customer Notes', 'General Notes', 'Notes', 'Details']),
    equipmentNotes: value(['Equipment Notes']),
    maintenanceNotes: value(['Maintenance Notes']),
    openingNotes: value(['Opening Notes']),
    closingNotes: value(['Closing Notes'])
  });
}

function getPmosCustomerContextNotes(customerId) {
  return getPmosCustomerContextNotes_(customerId);
}

function savePmosCustomerContextNotes_(customerId, input) {
  const source = input || {};
  ensurePmosCustomerContextNotesTable_();
  const record = getPmosCustomerEditorRow_(customerId);
  const values = record.values.slice();
  const fields = [
    {aliases: ['Customer Notes', 'General Notes', 'Notes', 'Details'], value: source.generalNotes != null ? source.generalNotes : source.notes},
    {aliases: ['Equipment Notes'], value: source.equipmentNotes},
    {aliases: ['Maintenance Notes'], value: source.maintenanceNotes},
    {aliases: ['Opening Notes'], value: source.openingNotes},
    {aliases: ['Closing Notes'], value: source.closingNotes}
  ];
  fields.forEach(function(field) {
    if (field.value == null) return;
    pmosCustomerEditorSetAliases_(record.headers, values, field.aliases, String(field.value || '').trim());
  });
  record.sheet.getRange(record.rowNumber, 1, 1, values.length).setValues([values]);
  SpreadsheetApp.flush();
  return getPmosCustomerContextNotes_(customerId);
}

function normalizePmosProfileEquipmentForContext_(profile) {
  const output = profile || {};
  const bodies = Array.isArray(output.bodiesOfWater) ? output.bodiesOfWater : [];
  bodies.forEach(function(body) {
    body.equipment = Array.isArray(body.equipment) ? body.equipment : [];
    body.equipment.forEach(function(item) {
      if (!item || typeof item !== 'object') return;
      const details = item.details && typeof item.details === 'object' ? item.details : {};
      ['make', 'manufacturer', 'model', 'modelNumber', 'controller', 'purpose', 'connectedTo'].forEach(function(key) {
        if (item[key] == null && details[key] != null) item[key] = details[key];
      });
    });
    const chemistry = body.equipment.some(function(item) { return item && item.type === 'CHEMISTRY_AUTOMATION'; });
    if (chemistry) {
      const existing = {};
      body.equipment.forEach(function(item) { if (item && item.type) existing[item.type] = true; });
      if (!existing.ACID_TANK) body.equipment.push({type: 'ACID_TANK', name: 'Acid Tank', purpose: 'Chemistry automation pH dosing'});
      if (!existing.PH_PROBE) body.equipment.push({type: 'PH_PROBE', name: 'pH Probe', connectedTo: 'Chemistry Automation'});
      if (!existing.ORP_PROBE) body.equipment.push({type: 'ORP_PROBE', name: 'ORP Probe', connectedTo: 'Chemistry Automation'});
      if (String(body.sanitization || '').toLowerCase() === 'chlorine' && !existing.CHLORINE_TANK) {
        body.equipment.push({type: 'CHLORINE_TANK', name: 'Chlorine Tank', purpose: 'Liquid chlorine feed'});
      }
    }
  });
  output.bodiesOfWater = bodies;
  return output;
}

(function () {
  if (typeof createPmosCustomerAccount === 'function') {
    const baseCreatePmosCustomerAccount = createPmosCustomerAccount;
    createPmosCustomerAccount = function(input) {
      const result = baseCreatePmosCustomerAccount(input);
      try {
        result.contextNotes = savePmosCustomerContextNotes_(result.customerId, input || {});
      } catch (error) {
        result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
        result.warnings.push('Customer created, but contextual notes could not be saved: ' + (error && error.message ? error.message : String(error)));
      }
      return result;
    };
  }

  if (typeof createMaintenanceCustomer === 'function') {
    const baseCreateMaintenanceCustomer = createMaintenanceCustomer;
    createMaintenanceCustomer = function(input) {
      const result = baseCreateMaintenanceCustomer(input);
      try {
        result.contextNotes = savePmosCustomerContextNotes_(result.customerId, input || {});
      } catch (error) {
        result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
        result.warnings.push('Maintenance customer created, but contextual notes could not be saved: ' + (error && error.message ? error.message : String(error)));
      }
      return result;
    };
  }

  if (typeof savePmosCustomerAccountEditorData === 'function') {
    const baseSavePmosCustomerAccountEditorData = savePmosCustomerAccountEditorData;
    savePmosCustomerAccountEditorData = function(input) {
      const result = baseSavePmosCustomerAccountEditorData(input);
      try {
        result.contextNotes = savePmosCustomerContextNotes_(result.customerId, input || {});
      } catch (error) {
        result.contextNoteWarning = 'Customer saved, but contextual notes could not be saved: ' + (error && error.message ? error.message : String(error));
      }
      result.profile = normalizePmosProfileEquipmentForContext_(getPmosCustomerAccountProfile(result.customerId));
      return result;
    };
  }

  if (typeof getPmosCustomerAccountProfile === 'function') {
    const baseGetPmosCustomerAccountProfile = getPmosCustomerAccountProfile;
    getPmosCustomerAccountProfile = function(customerId) {
      const profile = baseGetPmosCustomerAccountProfile(customerId);
      const notes = getPmosCustomerContextNotes_(customerId);
      profile.generalNotes = notes.generalNotes;
      profile.equipmentNotes = notes.equipmentNotes;
      profile.maintenanceNotes = notes.maintenanceNotes;
      profile.openingNotes = notes.openingNotes;
      profile.closingNotes = notes.closingNotes;
      profile.notes = notes.generalNotes;
      return normalizePmosProfileEquipmentForContext_(profile);
    };
  }

  if (typeof getPmosCustomerAccountEditorData === 'function') {
    const baseGetPmosCustomerAccountEditorData = getPmosCustomerAccountEditorData;
    getPmosCustomerAccountEditorData = function(customerId) {
      const data = baseGetPmosCustomerAccountEditorData(customerId);
      const notes = getPmosCustomerContextNotes_(customerId);
      data.generalNotes = notes.generalNotes;
      data.equipmentNotes = notes.equipmentNotes;
      data.maintenanceNotes = notes.maintenanceNotes;
      data.openingNotes = notes.openingNotes;
      data.closingNotes = notes.closingNotes;
      data.notes = notes.generalNotes;
      return normalizePmosProfileEquipmentForContext_(data);
    };
  }

  if (typeof buildPmosCustomerAccountLookupHtml_ === 'function') {
    const baseBuildPmosCustomerAccountLookupHtml = buildPmosCustomerAccountLookupHtml_;
    buildPmosCustomerAccountLookupHtml_ = function(mode, initialCustomerId) {
      let html = baseBuildPmosCustomerAccountLookupHtml(mode, initialCustomerId);
      html = html.split('Customer Notes').join('General Notes');
      html = html.replace('</style>', '.pmos-context-notes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}.pmos-context-note{padding:11px;border:1px solid #d2dade;border-radius:8px;background:#f9fafb}.pmos-context-note b{display:block;color:#6f7d84;font-size:9px;text-transform:uppercase}.pmos-context-note div{margin-top:5px;white-space:pre-wrap;font-size:11px;line-height:1.5}@media(max-width:760px){.pmos-context-notes{grid-template-columns:1fr}}\n</style>');
      html = html.replace('</script></body></html>', `
var pmosBaseContextRenderProfile=renderProfile;
renderProfile=function(profile){
  pmosBaseContextRenderProfile(profile);
  if(window.__pmosProfileEnhancementLoaded)return;
  var entries=[['Maintenance Notes',(profile.frequency||(profile.routes||[]).length)?profile.maintenanceNotes:''],['Opening Notes',profile.openingNotes],['Closing Notes',profile.closingNotes]].filter(function(item){return String(item[1]||'').trim()});
  if(!entries.length)return;
  var target=document.getElementById('content');if(!target)return;
  target.insertAdjacentHTML('beforeend','<div class="section"><div class="section-head"><h3>Context Notes</h3></div><div class="pmos-context-notes">'+entries.map(function(item){return '<div class="pmos-context-note"><b>'+esc(item[0])+'</b><div>'+esc(item[1])+'</div></div>'}).join('')+'</div></div>');
};
</script></body></html>`);
      return html;
    };
  }
})();
