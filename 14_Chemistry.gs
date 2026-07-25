/**
 * PMOS v1.9.0 — 14_Chemistry.gs.
 * Move-only refactor: public names and operational behavior are preserved.
 */

function getChemicalCatalog() {
  ensureChemicalSheets_();


  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_CHEMISTRY.PRODUCTS_SHEET);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];


  const headers = values[0].map(v => String(v).trim());


  return values.slice(1)
    .filter(row => String(row[headers.indexOf('Active')] || '').toLowerCase() !== 'no')
    .map(row => {
      const obj = {};
      headers.forEach((header, index) => obj[header] = row[index]);


      return {
        category: String(obj['Category'] || ''),
        product: String(obj['Product'] || ''),
        entryUnit: String(obj['Entry Unit'] || ''),
        metricType: String(obj['Metric Type'] || ''),
        metricPerUnit: Number(obj['Metric Per Unit'] || 0),
        metricUnit: String(obj['Metric Unit'] || ''),
        allowFractions: String(obj['Allow Fractions'] || '').toLowerCase() !== 'no',
        notes: String(obj['Notes'] || '')
      };
    })
    .filter(item => item.product)
    .sort((a, b) => a.category.localeCompare(b.category) || a.product.localeCompare(b.product));
}

function previewChemicalDose(productName, amountText) {
  const product = getChemicalCatalog().find(item => item.product === productName);
  if (!product) throw new Error(`Product not found: ${productName}`);


  const parsed = parseFlexibleQuantity_(amountText);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Enter a valid amount such as ½, 1/2, 0.5, 1 1/2, or 1.5.');
  }


  const normalized = normalizeChemicalAmount_(product, parsed);


  return {
    product,
    enteredAmount: String(amountText),
    parsedQuantity: parsed,
    normalizedMetricValue: normalized.metricValue,
    normalizedMetricUnit: normalized.metricUnit,
    displayRecord: normalized.displayRecord
  };
}

function saveChemicalUsage(payload) {
  ensureChemicalSheets_();


  if (!payload || !Array.isArray(payload.items) || !payload.items.length) {
    throw new Error('No chemical products were supplied.');
  }


  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_CHEMISTRY.USAGE_SHEET);
  const catalog = getChemicalCatalog();
  const byName = {};
  catalog.forEach(product => byName[product.product] = product);


  const rows = payload.items.map(item => {
    const product = byName[item.product];
    if (!product) throw new Error(`Unknown product: ${item.product}`);


    const parsed = parseFlexibleQuantity_(item.amount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`Invalid amount for ${item.product}: ${item.amount}`);
    }


    const normalized = normalizeChemicalAmount_(product, parsed);


    return [
      new Date(),
      payload.visitDate || '',
      payload.customerId || '',
      payload.customer || '',
      payload.technician || '',
      product.category,
      product.product,
      String(item.amount),
      product.entryUnit,
      parsed,
      normalized.metricValue,
      normalized.metricUnit,
      normalized.displayRecord,
      item.notes || ''
    ];
  });


  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);


  return {
    ok: true,
    count: rows.length,
    records: rows.map(row => ({
      product: row[6],
      displayRecord: row[12]
    }))
  };
}

function addChemicalProduct(payload) {
  ensureChemicalSheets_();


  const required = ['category','product','entryUnit','metricType','metricPerUnit','metricUnit'];
  required.forEach(field => {
    if (payload[field] === '' || payload[field] == null) {
      throw new Error(`Missing field: ${field}`);
    }
  });


  const sheet = SpreadsheetApp.getActive().getSheetByName(PMOS_CHEMISTRY.PRODUCTS_SHEET);
  sheet.appendRow([
    payload.category,
    payload.product,
    payload.entryUnit,
    payload.metricType,
    Number(payload.metricPerUnit),
    payload.metricUnit,
    payload.allowFractions === false ? 'No' : 'Yes',
    'Yes',
    payload.notes || ''
  ]);


  return { ok: true };
}

function parseFlexibleQuantity_(input) {
  if (input == null) return NaN;


  let text = String(input).trim().toLowerCase();
  if (!text) return NaN;


  const unicodeFractions = {
    '¼': 1 / 4,
    '⅓': 1 / 3,
    '½': 1 / 2,
    '⅔': 2 / 3,
    '¾': 3 / 4,
    '⅛': 1 / 8,
    '⅜': 3 / 8,
    '⅝': 5 / 8,
    '⅞': 7 / 8
  };


  text = text.replace(/,/g, '.');
  text = text.replace(/\b(cups?|litres?|liters?|l|kgs?|kilograms?|bags?|jugs?|blocks?)\b/g, '').trim();


  let unicodeTotal = 0;
  Object.keys(unicodeFractions).forEach(symbol => {
    if (text.includes(symbol)) {
      unicodeTotal += unicodeFractions[symbol];
      text = text.replace(symbol, ' ');
    }
  });


  text = text.replace(/\s+/g, ' ').trim();


  let numericTotal = 0;


  if (text) {
    const mixedMatch = text.match(/^([+-]?\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixedMatch) {
      const whole = Number(mixedMatch[1]);
      const numerator = Number(mixedMatch[2]);
      const denominator = Number(mixedMatch[3]);
      if (!denominator) return NaN;
      numericTotal = whole + numerator / denominator;
    } else {
      const fractionMatch = text.match(/^([+-]?\d+)\s*\/\s*(\d+)$/);
      if (fractionMatch) {
        const numerator = Number(fractionMatch[1]);
        const denominator = Number(fractionMatch[2]);
        if (!denominator) return NaN;
        numericTotal = numerator / denominator;
      } else {
        const value = Number(text);
        if (!Number.isFinite(value)) return NaN;
        numericTotal = value;
      }
    }
  }


  return numericTotal + unicodeTotal;
}

function normalizeChemicalAmount_(product, unitQuantity) {
  const rawMetric = unitQuantity * Number(product.metricPerUnit || 0);
  const metricType = String(product.metricType || '').toLowerCase();
  const sourceUnit = String(product.metricUnit || '');


  if (metricType === 'volume') {
    let litres;


    if (sourceUnit.toLowerCase() === 'ml') {
      litres = rawMetric / 1000;
    } else {
      litres = rawMetric;
    }


    const totalMl = Math.round(litres * 1000);
    const wholeL = Math.floor(totalMl / 1000);
    const ml = totalMl % 1000;


    return {
      metricValue: roundTo_(litres, 6),
      metricUnit: 'L',
      displayRecord: formatLitresMillilitres_(wholeL, ml)
    };
  }


  if (metricType === 'mass') {
    let grams;


    if (sourceUnit.toLowerCase() === 'kg') {
      grams = rawMetric * 1000;
    } else if (sourceUnit.toLowerCase() === 'lb') {
      grams = rawMetric * 453.59237;
    } else {
      grams = rawMetric;
    }


    const roundedGrams = Math.round(grams);
    const kg = Math.floor(roundedGrams / 1000);
    const g = roundedGrams % 1000;


    return {
      metricValue: roundTo_(grams / 1000, 6),
      metricUnit: 'kg',
      displayRecord: formatKilogramsGrams_(kg, g)
    };
  }


  return {
    metricValue: roundTo_(rawMetric, 6),
    metricUnit: sourceUnit || product.entryUnit,
    displayRecord: `${roundTo_(rawMetric, 6)} ${sourceUnit || product.entryUnit}`
  };
}

function formatLitresMillilitres_(litres, millilitres) {
  if (litres && millilitres) return `${litres} L ${millilitres} mL`;
  if (litres) return `${litres} L`;
  return `${millilitres} mL`;
}

function formatKilogramsGrams_(kg, g) {
  if (kg && g) return `${kg} kg ${g} g`;
  if (kg) return `${kg} kg`;
  return `${g} g`;
}

function roundTo_(value, places) {
  const factor = Math.pow(10, places);
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function ensureChemicalSheets_() {
  const ss = SpreadsheetApp.getActive();


  let products = ss.getSheetByName(PMOS_CHEMISTRY.PRODUCTS_SHEET);
  if (!products) {
    products = ss.insertSheet(PMOS_CHEMISTRY.PRODUCTS_SHEET);
    products.appendRow([
      'Category','Product','Entry Unit','Metric Type','Metric Per Unit',
      'Metric Unit','Allow Fractions','Active','Notes'
    ]);
  }


  let usage = ss.getSheetByName(PMOS_CHEMISTRY.USAGE_SHEET);
  if (!usage) {
    usage = ss.insertSheet(PMOS_CHEMISTRY.USAGE_SHEET);
    usage.appendRow([
      'Timestamp','Visit Date','Customer ID','Customer','Technician','Category',
      'Product','Entered Amount','Entry Unit','Parsed Unit Quantity',
      'Normalized Metric Value','Normalized Metric Unit','Display Record','Notes'
    ]);
  }
}

function showChemistryCatalog() {
  const html = HtmlService.createHtmlOutput(
    `<div style="font-family:Arial;padding:18px">
      <h2>PMOS Chemistry Catalog</h2>
      <p>Select products in the PMOS app or edit the Chemical Products sheet.</p>
      <p>Accepted amounts include: ¼, 1/4, ½, 0.5, 1 1/2, and decimals.</p>
      <p>PMOS stores normalized records such as 1 L 250 mL or 2 kg 500 g.</p>
      <button onclick="google.script.run.withSuccessHandler(function(){google.script.host.close();}).ensureChemicalSheets_()">Repair Chemistry Sheets</button>
    </div>`
  ).setWidth(480).setHeight(300);


  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS Chemistry Catalog');
}

