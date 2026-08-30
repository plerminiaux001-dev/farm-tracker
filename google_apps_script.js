/**
 * FARM TRACKER - Google Apps Script Backend
 * 
 * Instructions:
 * 1. Create a new Google Sheet (e.g. named 'Farm Tracker DB')
 * 2. In Google Sheets, click Extensions > Apps Script
 * 3. Delete any code in Code.gs and paste this entire file
 * 4. Click 'Deploy' > 'New deployment'
 * 5. Select type: 'Web app'
 * 6. Set 'Execute as': 'Me'
 * 7. Set 'Who has access': 'Anyone' (so your web app can send data without OAuth complications)
 * 8. Copy the Web App URL and paste it into Farm Tracker Settings!
 */

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = (e.parameter && e.parameter.action) || 'getAll';
    
    initSheets(ss);
    
    var responseData = {};
    if (action === 'getAll' || action === 'getCrops') {
      responseData.crops = readSheet(ss.getSheetByName('Crops'));
    }
    if (action === 'getAll' || action === 'getPlans') {
      responseData.plans = readSheet(ss.getSheetByName('Planting Plans'));
    }
    if (action === 'getAll' || action === 'getLogs') {
      responseData.logs = readSheet(ss.getSheetByName('Logs'));
    }
    if (action === 'getAll' || action === 'getSettings') {
      responseData.settings = readSheet(ss.getSheetByName('Settings'));
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: responseData
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheets(ss);
    
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    
    if (action === 'addLog') {
      var sheet = ss.getSheetByName('Logs');
      var row = [
        payload.id || Utilities.getUuid(),
        payload.date || new Date().toISOString().split('T')[0],
        payload.lifecycle_type || '',
        payload.category || '',
        payload.vegetable || '',
        payload.variety || '',
        payload.row_id || '',
        payload.quantity || 0,
        payload.weight || 0,
        payload.notes || '',
        payload.plant_id || '',
        new Date()
      ];
      sheet.appendRow(row);
      return jsonResponse({ status: 'success', message: 'Log added', id: row[0] });
    }
    
    if (action === 'savePlan') {
      var planSheet = ss.getSheetByName('Planting Plans');
      var plan = payload.plan;
      var planRow = [
        plan.id || Utilities.getUuid(),
        plan.crop_id || '',
        plan.category || '',
        plan.vegetable || '',
        plan.variety || '',
        plan.sow_type || 'indoor',
        plan.indoor_sow_date || '',
        plan.plant_date || '',
        plan.harvest_start || '',
        plan.harvest_end || '',
        plan.row_bed || '',
        plan.target_quantity || 0,
        plan.status || 'planned',
        new Date()
      ];
      planSheet.appendRow(planRow);
      return jsonResponse({ status: 'success', message: 'Plan saved', id: planRow[0] });
    }
    
    if (action === 'syncBulk') {
      // Sync bulk logs, plans, and crops
      
      if (payload.crops && payload.crops.length > 0) {
        var cropSheet = ss.getSheetByName('Crops');
        var existingData = cropSheet.getDataRange().getValues();
        var existingNames = {};
        for (var i = 1; i < existingData.length; i++) {
          existingNames[existingData[i][1] + '_' + existingData[i][2] + '_' + existingData[i][3]] = true;
        }
        payload.crops.forEach(function(c) {
          var key = (c.category || '') + '_' + (c.vegetable || '') + '_' + (c.variety || '');
          if (!existingNames[key]) {
            cropSheet.appendRow([
              c.id || Utilities.getUuid(),
              c.category || '',
              c.vegetable || '',
              c.variety || '',
              c.pos_description || '',
              c.sow_method || 'indoor',
              c.dtm || 65,
              c.spacing_in || 12,
              new Date()
            ]);
            existingNames[key] = true;
          }
        });
      }

      if (payload.logs && payload.logs.length > 0) {
        var logSheet = ss.getSheetByName('Logs');
        payload.logs.forEach(function(l) {
          logSheet.appendRow([
            l.id || Utilities.getUuid(),
            l.date || '',
            l.lifecycle_type || '',
            l.category || '',
            l.vegetable || '',
            l.variety || '',
            l.row_id || '',
            l.quantity || 0,
            l.weight || 0,
            l.notes || '',
            l.plant_id || '',
            new Date()
          ]);
        });
      }
      return jsonResponse({ status: 'success', message: 'Bulk sync completed' });
    }

    return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function initSheets(ss) {
  var sheets = {
    'Crops': ['ID', 'Category', 'Vegetable', 'Variety', 'POS Description', 'Sow Method', 'DTM', 'Spacing (in)', 'Updated At'],
    'Planting Plans': ['Plan ID', 'Crop ID', 'Category', 'Vegetable', 'Variety', 'Sow Type', 'Indoor Sow Date', 'Plant Date', 'Harvest Start', 'Harvest End', 'Bed/Row', 'Target Qty', 'Status', 'Updated At'],
    'Logs': ['Log ID', 'Date', 'Lifecycle Type', 'Category', 'Vegetable', 'Variety', 'Bed/Row', 'Quantity', 'Weight (lbs)', 'Notes', 'Plant ID', 'Logged At'],
    'Settings': ['Key', 'Value', 'Updated At']
  };
  
  for (var name in sheets) {
    var s = ss.getSheetByName(name);
    if (!s) {
      s = ss.insertSheet(name);
      s.appendRow(sheets[name]);
      s.getRange(1, 1, 1, sheets[name].length).setFontWeight('bold').setBackground('#E2F0D9');
      s.setFrozenRows(1);
    }
  }
}

function readSheet(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = String(headers[j]).toLowerCase().replace(/[^a-z0-9]/g, '_');
      obj[key] = data[i][j];
    }
    rows.push(obj);
  }
  return rows;
}
