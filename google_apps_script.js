/**
 * FARM TRACKER - Google Apps Script Web App Backend
 * 
 * Deployment Instructions:
 * 1. Open Google Sheet > Extensions > Apps Script.
 * 2. Paste this entire code into Code.gs.
 * 3. Click 'Deploy' > 'Manage deployments' > Edit ✏️ (or 'New deployment').
 * 4. IMPORTANT: Set 'Execute as' to 'Me', and set 'Who has access' to 'ANYONE'.
 * 5. Copy the Web App URL and paste into Farm Tracker Settings!
 */

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = (e.parameter && e.parameter.action) || 'getAll';
    
    var responseData = {
      crops: findAndReadSheet(ss, ['Crops', 'crops_and_varieties', 'plant', 'plants']),
      plans: findAndReadSheet(ss, ['Planting Plans', 'Plans', 'planting_plans']),
      logs: findAndReadSheet(ss, ['Logs', 'Planting Logs', 'planting_lifecycle_logs', 'plant_lifecycle']),
      settings: findAndReadSheet(ss, ['Settings', 'Farm Settings', 'settings'])
    };
    
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
    
    if (action === 'syncBulk') {
      // 1. Sync Crops
      if (payload.crops && payload.crops.length > 0) {
        var cropSheet = getOrCreateSheet(ss, 'Crops', ['ID', 'Category', 'Vegetable', 'Variety', 'POS Description', 'Sow Method', 'DTM', 'Spacing (in)', 'Updated At']);
        var existingData = cropSheet.getDataRange().getValues();
        var existingNames = {};
        for (var i = 1; i < existingData.length; i++) {
          existingNames[String(existingData[i][1]).toLowerCase() + '_' + String(existingData[i][2]).toLowerCase() + '_' + String(existingData[i][3]).toLowerCase()] = true;
        }
        payload.crops.forEach(function(c) {
          var key = (c.category || '').toLowerCase() + '_' + (c.vegetable || '').toLowerCase() + '_' + (c.variety || '').toLowerCase();
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

      // 2. Sync Plans
      if (payload.plans && payload.plans.length > 0) {
        var planSheet = getOrCreateSheet(ss, 'Planting Plans', ['Plan ID', 'Crop ID', 'Category', 'Vegetable', 'Variety', 'Sow Type', 'Indoor Sow Date', 'Plant Date', 'Harvest Start', 'Harvest End', 'Bed/Row', 'Target Qty', 'Status', 'Updated At']);
        planSheet.clearContents();
        planSheet.appendRow(['Plan ID', 'Crop ID', 'Category', 'Vegetable', 'Variety', 'Sow Type', 'Indoor Sow Date', 'Plant Date', 'Harvest Start', 'Harvest End', 'Bed/Row', 'Target Qty', 'Status', 'Updated At']);
        payload.plans.forEach(function(plan) {
          planSheet.appendRow([
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
          ]);
        });
      }

      // 3. Sync User Logs
      if (payload.logs && payload.logs.length > 0) {
        var logSheet = getOrCreateSheet(ss, 'Logs', ['Log ID', 'Date', 'Lifecycle Type', 'Category', 'Vegetable', 'Variety', 'Bed/Row', 'Quantity', 'Weight (lbs)', 'Notes', 'Plant ID', 'Logged At']);
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

      return jsonResponse({ status: 'success', message: 'Bulk sync completed successfully' });
    }

    return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function findAndReadSheet(ss, candidateNames) {
  for (var i = 0; i < candidateNames.length; i++) {
    var sheet = ss.getSheetByName(candidateNames[i]);
    if (sheet) {
      return readSheet(sheet);
    }
  }
  return [];
}

function getOrCreateSheet(ss, name, headers) {
  var s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.appendRow(headers);
    s.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E2F0D9');
    s.setFrozenRows(1);
  }
  return s;
}

function initSheets(ss) {
  getOrCreateSheet(ss, 'Crops', ['ID', 'Category', 'Vegetable', 'Variety', 'POS Description', 'Sow Method', 'DTM', 'Spacing (in)', 'Updated At']);
  getOrCreateSheet(ss, 'Planting Plans', ['Plan ID', 'Crop ID', 'Category', 'Vegetable', 'Variety', 'Sow Type', 'Indoor Sow Date', 'Plant Date', 'Harvest Start', 'Harvest End', 'Bed/Row', 'Target Qty', 'Status', 'Updated At']);
  getOrCreateSheet(ss, 'Logs', ['Log ID', 'Date', 'Lifecycle Type', 'Category', 'Vegetable', 'Variety', 'Bed/Row', 'Quantity', 'Weight (lbs)', 'Notes', 'Plant ID', 'Logged At']);
  getOrCreateSheet(ss, 'Settings', ['Key', 'Value', 'Updated At']);
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
