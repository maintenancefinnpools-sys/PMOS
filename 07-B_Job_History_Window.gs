/** Public Job Center endpoint. Opens history without replacing the Job Center modal. */
function showPmosJobHistoryWindow() {
  const sheet = ensurePmosJobHistorySheet_();
  const rows = sheet.getDataRange().getValues()
    .slice(1)
    .reverse()
    .slice(0, 50);

  const body = rows.length
    ? rows.map(function (row) {
        return '<tr>' +
          '<td>' + escapeHtml_(formatJobHistoryDate_(row[0])) + '</td>' +
          '<td>' + escapeHtml_(row[3]) + '</td>' +
          '<td>' + escapeHtml_(row[4]) + '</td>' +
          '<td>' + escapeHtml_(row[5]) + '</td>' +
          '<td>' + escapeHtml_(row[6]) + '</td>' +
          '<td>' + escapeHtml_(row[7]) + '</td>' +
        '</tr>';
      }).join('')
    : '<tr><td colspan="6" class="empty">No completed jobs yet.</td></tr>';

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:16px;color:#1f2937;background:#fff}h2{margin:0 0 4px}.muted{font-size:13px;color:#64748b;margin-bottom:14px}.table-wrap{max-height:470px;overflow:auto;border:1px solid #e2e8f0;border-radius:9px}table{border-collapse:collapse;width:100%;font-size:13px}thead{position:sticky;top:0;background:#f8fafc;z-index:1}th,td{text-align:left;border-bottom:1px solid #e2e8f0;padding:8px;vertical-align:top}th{font-size:12px;color:#475569}.empty{padding:24px;color:#64748b;text-align:center}.actions{display:flex;justify-content:flex-end;margin-top:12px}button{border:0;border-radius:8px;padding:9px 13px;font-weight:700;cursor:pointer;background:#e2e8f0;color:#1f2937;transition:transform .08s ease,background .15s ease}button:active{transform:translateY(1px);background:#cbd5e1}
</style></head><body>
<h2>PMOS Job History</h2><div class="muted">Closing this window returns you to the open Job Center.</div>
<div class="table-wrap"><table><thead><tr><th>Time</th><th>Job</th><th>Result</th><th>Batches</th><th>Items</th><th>Summary</th></tr></thead><tbody>${body}</tbody></table></div>
<div class="actions"><button type="button" onclick="this.disabled=true;this.textContent='Closing…';google.script.host.close()">Close</button></div>
</body></html>`).setWidth(900).setHeight(590);

  SpreadsheetApp.getUi().showModelessDialog(html, 'PMOS Job History');
  return {opened: true, rowCount: rows.length};
}
