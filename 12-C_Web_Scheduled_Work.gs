/**
 * Shared PMOS Scheduled Work backend for Service Call, Opening, and Closing.
 *
 * The hidden sheet is the source of truth. Calendar is a derived execution view.
 * A work record is written before Calendar mutation so a failed Calendar write can
 * be retried without creating a duplicate PMOS work item.
 */
const PMOS_SCHEDULED_WORK_SHEET = 'PMOS Scheduled Work';
const PMOS_SCHEDULED_WORK_HEADERS = Object.freeze([
  'Work ID','Work Type','Status','Customer ID','Account ID','Account Name',
  'Service Location Name','First Name','Last Name','Calendar Title','Address',
  'Phone','Email','Scheduled Date','Stop Position','Duration Minutes','Work Summary',
  'Entry Information','Customer Notes','Calendar Event ID','Created At','Updated At','Last Error'
]);

function ensurePmosScheduledWorkSheet_() {
  const spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getSheetByName(PMOS_SCHEDULED_WORK_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(PMOS_SCHEDULED_WORK_SHEET);
  if (sheet.getMaxColumns() < PMOS_SCHEDULED_WORK_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), PMOS_SCHEDULED_WORK_HEADERS.length - sheet.getMaxColumns());
  }
  sheet.getRange(1,1,1,PMOS_SCHEDULED_WORK_HEADERS.length).setValues([PMOS_SCHEDULED_WORK_HEADERS.slice()]);
  sheet.setFrozenRows(1);
  if (!sheet.isSheetHidden()) sheet.hideSheet();
  return sheet;
}

function getPmosScheduledWorkCustomerLocation(customerId) {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('Select a customer service location.');
  const profile = getPmosCustomerAccountProfile(id);
  const selected = profile.selectedServiceLocation || {};
  const address = String(profile.address || selected.address || '').trim();
  if (!address) throw new Error('The selected service location does not have an address.');
  const point = geocodePmosAddress_(Maps.newGeocoder(), address, false);
  return {
    customerId: String(profile.customerId || id),
    accountId: String(profile.accountId || ''),
    accountName: String(profile.accountName || profile.displayName || ''),
    serviceLocationName: String(profile.locationName || selected.locationName || profile.calendarTitle || ''),
    firstName: String(profile.firstName || ''),
    lastName: String(profile.lastName || ''),
    phone: String(profile.phone || ''),
    email: String(profile.email || ''),
    entryInformation: String(profile.entryInformation || ''),
    notes: String(profile.notes || ''),
    address: address,
    addressDetails: {address:address, lat:Number(point.lat), lng:Number(point.lng)}
  };
}

function createPmosScheduledWork(payload) {
  const input = payload || {};
  const type = normalizePmosScheduledWorkType_(input.workType);
  const location = getPmosScheduledWorkCustomerLocation(input.customerId);
  const serviceDate = parsePmosScheduledWorkDate_(input.date);
  const stopPosition = Math.max(1, Math.floor(Number(input.stopPosition || 1)));
  const durationMinutes = clampPmosScheduledWorkDuration_(input.durationMinutes, type);
  const workSummary = String(input.workSummary || '').trim();
  const defaultSubject = type === 'SERVICE_CALL' ? 'Service' : (type === 'OPENING' ? 'Opening' : 'Closing');
  const identity = String(location.lastName || location.accountName || location.serviceLocationName || '').trim();
  const calendarTitle = String(input.calendarTitle || '').trim() || [defaultSubject, identity].filter(Boolean).join(' — ');
  if (!calendarTitle) throw new Error('Enter a Calendar title.');

  const now = new Date();
  const workId = Utilities.getUuid();
  const row = [
    workId,type,'PENDING_CALENDAR',location.customerId,location.accountId,location.accountName,
    location.serviceLocationName,location.firstName,location.lastName,calendarTitle,location.address,
    location.phone,location.email,Utilities.formatDate(serviceDate,PMOS.TIMEZONE,'yyyy-MM-dd'),
    stopPosition,durationMinutes,workSummary,
    String(input.entryInformation != null ? input.entryInformation : location.entryInformation || ''),
    String(input.customerNotes != null ? input.customerNotes : location.notes || ''),'',now,now,''
  ];
  const sheet = ensurePmosScheduledWorkSheet_();
  sheet.getRange(sheet.getLastRow()+1,1,1,row.length).setValues([row]);

  try {
    const synced = syncPmosScheduledWorkItem(workId);
    return {created:true,calendarSynced:true,workId:workId,work:synced};
  } catch (error) {
    updatePmosScheduledWorkFields_(workId,{Status:'PENDING_CALENDAR','Last Error':String(error && error.message || error),'Updated At':new Date()});
    return {created:true,calendarSynced:false,workId:workId,error:String(error && error.message || error),work:getPmosScheduledWorkItem_(workId)};
  }
}

function syncPmosScheduledWorkItem(workId) {
  const record = getPmosScheduledWorkItem_(workId);
  if (!record) throw new Error('Scheduled work record was not found.');
  const calendar = getRecurringCalendar_();
  const settings = getRecurringCalendarSettings_();
  const serviceDate = parsePmosScheduledWorkDate_(record.scheduledDate);
  const dayStart = new Date(serviceDate); dayStart.setHours(0,0,0,0);
  const dayEnd = new Date(serviceDate); dayEnd.setHours(23,59,59,999);
  let event = null;
  if (record.calendarEventId) {
    try { event = calendar.getEventById(record.calendarEventId); } catch (error) { event = null; }
  }

  const description = buildPmosScheduledWorkDescription_(record);
  const routeEvents = calendar.getEvents(dayStart,dayEnd)
    .filter(function(item){return !item.isAllDayEvent();})
    .filter(function(item){return !event || String(item.getId() || '') !== String(event.getId() || '');})
    .sort(function(a,b){return a.getStartTime()-b.getStartTime();});
  const position = Math.min(Math.max(1,Number(record.stopPosition||1)),routeEvents.length+1);
  const provisionalStart = routeTimeForOrder_(serviceDate,position,settings);
  const provisionalEnd = new Date(provisionalStart.getTime()+Number(record.durationMinutes||settings.eventDurationMinutes)*60000);

  if (!event) {
    event = calendar.createEvent(record.calendarTitle,provisionalStart,provisionalEnd,{location:record.address,description:description});
    updatePmosScheduledWorkFields_(record.workId,{
      Status:'CALENDAR_CREATED','Calendar Event ID':String(event.getId() || ''),'Last Error':'','Updated At':new Date()
    });
  } else {
    if (String(event.getTitle() || '') !== record.calendarTitle) event.setTitle(record.calendarTitle);
    if (String(event.getLocation() || '') !== record.address) event.setLocation(record.address);
    if (String(event.getDescription() || '') !== description) event.setDescription(description);
  }

  const ordered = routeEvents.slice();
  ordered.splice(position-1,0,event);
  let cursor = routeTimeForOrder_(serviceDate,1,settings);
  ordered.forEach(function(item) {
    const isTarget = String(item.getId() || '') === String(event.getId() || '');
    const existingDuration = Math.max(1,Math.round((item.getEndTime().getTime()-item.getStartTime().getTime())/60000));
    const duration = isTarget ? Number(record.durationMinutes||settings.eventDurationMinutes) : existingDuration;
    const newStart = new Date(cursor.getTime());
    const newEnd = new Date(newStart.getTime()+duration*60000);
    if (item.getStartTime().getTime() !== newStart.getTime() || item.getEndTime().getTime() !== newEnd.getTime()) {
      item.setTime(newStart,newEnd);
    }
    cursor = newEnd;
  });

  invalidateTemporaryRouteSnapshot_(serviceDate);
  updatePmosScheduledWorkFields_(record.workId,{Status:'SCHEDULED','Calendar Event ID':String(event.getId() || ''),'Last Error':'','Updated At':new Date()});
  return getPmosScheduledWorkItem_(record.workId);
}

function getPmosScheduledWorkHistory(limit) {
  const maxRows = Math.max(1,Math.min(200,Number(limit||50)));
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_SCHEDULED_WORK_SHEET);
  if (!sheet || sheet.getLastRow()<2) return [];
  const count = Math.min(maxRows,sheet.getLastRow()-1);
  const values = sheet.getRange(sheet.getLastRow()-count+1,1,count,PMOS_SCHEDULED_WORK_HEADERS.length).getValues();
  return values.reverse().map(function(row){return pmosScheduledWorkRowToObject_(row);});
}

function getPmosScheduledWorkItem_(workId) {
  const id = String(workId || '').trim();
  if (!id) return null;
  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_SCHEDULED_WORK_SHEET);
  if (!sheet || sheet.getLastRow()<2) return null;
  const values = sheet.getRange(2,1,sheet.getLastRow()-1,PMOS_SCHEDULED_WORK_HEADERS.length).getValues();
  for (let i=0;i<values.length;i++) {
    if (String(values[i][0] || '') === id) {
      const record = pmosScheduledWorkRowToObject_(values[i]);
      record.rowNumber = i+2;
      return record;
    }
  }
  return null;
}

function updatePmosScheduledWorkFields_(workId, fields) {
  const record = getPmosScheduledWorkItem_(workId);
  if (!record || !record.rowNumber) throw new Error('Scheduled work record was not found: '+workId+'.');
  const sheet = ensurePmosScheduledWorkSheet_();
  const indexByHeader = {};
  PMOS_SCHEDULED_WORK_HEADERS.forEach(function(header,index){indexByHeader[header]=index+1;});
  Object.keys(fields||{}).forEach(function(header){
    if (!indexByHeader[header]) throw new Error('Unknown Scheduled Work field: '+header+'.');
    sheet.getRange(record.rowNumber,indexByHeader[header]).setValue(fields[header]);
  });
}

function pmosScheduledWorkRowToObject_(row) {
  return {
    workId:String(row[0]||''),workType:String(row[1]||''),status:String(row[2]||''),
    customerId:String(row[3]||''),accountId:String(row[4]||''),accountName:String(row[5]||''),
    serviceLocationName:String(row[6]||''),firstName:String(row[7]||''),lastName:String(row[8]||''),
    calendarTitle:String(row[9]||''),address:String(row[10]||''),phone:String(row[11]||''),email:String(row[12]||''),
    scheduledDate:formatPmosScheduledWorkCellDate_(row[13]),stopPosition:Number(row[14]||1),durationMinutes:Number(row[15]||60),
    workSummary:String(row[16]||''),entryInformation:String(row[17]||''),customerNotes:String(row[18]||''),
    calendarEventId:String(row[19]||''),createdAt:formatPmosScheduledWorkCellDateTime_(row[20]),updatedAt:formatPmosScheduledWorkCellDateTime_(row[21]),lastError:String(row[22]||'')
  };
}

function buildPmosScheduledWorkDescription_(record) {
  const label = record.workType === 'SERVICE_CALL' ? 'Service Call' : (record.workType === 'OPENING' ? 'Opening' : 'Closing');
  const lines = [label];
  if (record.accountName) lines.push('Customer: '+record.accountName);
  if (record.serviceLocationName) lines.push('Service Location: '+record.serviceLocationName);
  if (record.phone) lines.push('Phone: '+record.phone);
  if (record.email) lines.push('Email: '+record.email);
  if (record.workSummary) lines.push('\nWORK DETAILS\n'+record.workSummary);
  if (record.entryInformation) lines.push('\nENTRY INFORMATION\n'+record.entryInformation);
  if (record.customerNotes) lines.push('\nCUSTOMER NOTES\n'+record.customerNotes);
  lines.push('\nPMOS_MANAGED=true');
  lines.push('PMOS_EVENT_TYPE='+record.workType);
  lines.push('PMOS_SCHEDULED_WORK_ID='+record.workId);
  lines.push('PMOS_CUSTOMER_ID='+record.customerId);
  return lines.join('\n');
}

function normalizePmosScheduledWorkType_(value) {
  const type = String(value || '').trim().toUpperCase().replace(/[\s-]+/g,'_');
  if (['SERVICE_CALL','OPENING','CLOSING'].indexOf(type)<0) throw new Error('Unsupported scheduled work type: '+type+'.');
  return type;
}

function parsePmosScheduledWorkDate_(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Choose a valid scheduled date.');
  const date = new Date(Number(match[1]),Number(match[2])-1,Number(match[3]));
  if (date.getFullYear()!==Number(match[1])||date.getMonth()!==Number(match[2])-1||date.getDate()!==Number(match[3])) throw new Error('Choose a valid scheduled date.');
  date.setHours(12,0,0,0);
  return date;
}

function clampPmosScheduledWorkDuration_(value,type) {
  const fallback = type === 'SERVICE_CALL' ? 60 : 120;
  const number = Number(value == null || value === '' ? fallback : value);
  if (!Number.isFinite(number) || number < 15 || number > 480) throw new Error('Duration must be between 15 and 480 minutes.');
  return Math.round(number);
}

function formatPmosScheduledWorkCellDate_(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return Utilities.formatDate(value,PMOS.TIMEZONE,'yyyy-MM-dd');
  return String(value||'');
}

function formatPmosScheduledWorkCellDateTime_(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return Utilities.formatDate(value,PMOS.TIMEZONE,'yyyy-MM-dd h:mm a');
  return String(value||'');
}
