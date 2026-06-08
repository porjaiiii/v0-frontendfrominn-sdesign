function doPost(e) {
  try {
    Logger.log('===== REQUEST RECEIVED =====');
    Logger.log('Timestamp:', new Date().toISOString());
    
    const payload = JSON.parse(e.postData.contents);
    Logger.log('Parsed payload:', JSON.stringify(payload, null, 2));

    if (payload.action === 'registerUser') {
      Logger.log('→ Routing to registerUser');
      return registerUser(payload);
    } else if (payload.action === 'getUser') {
      Logger.log('→ Routing to getUser');
      return getUser(payload);
    }

    Logger.log('ERROR: Unknown action:', payload.action);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Unknown action: ' + payload.action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('ERROR in doPost:', error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function registerUser(payload) {
  try {
    Logger.log('===== REGISTER USER =====');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log('Spreadsheet:', ss.getName());
    Logger.log('Available sheets:', ss.getSheets().map(s => s.getName()).join(', '));
    
    const sheet = ss.getSheetByName('Registration');
    
    if (!sheet) {
      Logger.log('ERROR: Sheet "Registration" NOT FOUND');
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Sheet Registration not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    Logger.log('Sheet found: ' + sheet.getName());
    
    const lastColumn = sheet.getLastColumn();
    const lastRow = sheet.getLastRow();
    Logger.log('Sheet dimensions - Last column:', lastColumn, 'Last row:', lastRow);
    
    const headerRow = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    Logger.log('Headers:', JSON.stringify(headerRow));

    const newRow = [];
    for (let i = 0; i < headerRow.length; i++) {
      const header = headerRow[i];
      let value = '';

      switch (header) {
        case 'LINE User ID':
          value = payload.lineUserId || '';
          break;
        case 'User ID':
          value = payload.userId || '';
          break;
        case 'PDPA Consent':
          value = payload.pdpaConsent || '';
          break;
        case 'ชื่อ-นามสกุล':
          value = payload.fullName || '';
          break;
        case 'เบอร์ติดต่อ':
          value = payload.phoneNumber || '';
          break;
        case 'เพศ':
          value = payload.gender || '';
          break;
        case 'ช่วงอายุ':
          value = payload.ageRange || '';
          break;
        case 'ประเภทผู้ใช้งาน':
          value = payload.userType || '';
          break;
        case 'ตำบล':
          value = payload.subdistrict || '';
          break;
        case 'อาชีพ':
          value = payload.occupation || '';
          break;
        case 'วันที่สมัคร':
          value = payload.registrationDate || new Date().toLocaleDateString('th-TH');
          break;
      }

      newRow.push(value);
      Logger.log('  [' + header + '] = ' + value);
    }

    Logger.log('Appending row:', JSON.stringify(newRow));
    sheet.appendRow(newRow);
    
    const newLastRow = sheet.getLastRow();
    Logger.log('SUCCESS! Row added. New total rows:', newLastRow);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Registered successfully',
      row: newLastRow
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('ERROR in registerUser:', error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getUser(payload) {
  try {
    Logger.log('===== GET USER =====');
    
    if (!payload.lineUserId) {
      Logger.log('ERROR: lineUserId not provided');
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'lineUserId is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Registration');
    
    if (!sheet) {
      Logger.log('ERROR: Sheet "Registration" NOT FOUND');
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Sheet Registration not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    Logger.log('Searching for LINE ID:', payload.lineUserId);
    
    const lastColumn = sheet.getLastColumn();
    const lastRow = sheet.getLastRow();
    const headerRow = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    
    // Find LINE User ID column
    const lineUserIdColumnIndex = headerRow.findIndex(h => h === 'LINE User ID');
    
    if (lineUserIdColumnIndex === -1) {
      Logger.log('ERROR: LINE User ID column not found. Headers:', JSON.stringify(headerRow));
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'LINE User ID column not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Search for user row
    let userRow = null;
    let userRowIndex = -1;
    
    for (let i = 2; i <= lastRow; i++) {
      const row = sheet.getRange(i, 1, 1, lastColumn).getValues()[0];
      if (row[lineUserIdColumnIndex] === payload.lineUserId) {
        userRow = row;
        userRowIndex = i;
        break;
      }
    }

    if (!userRow) {
      Logger.log('User not found for LINE ID:', payload.lineUserId);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'User not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    Logger.log('Found user at row:', userRowIndex);

    // Map row to profile object
    const profile = {};
    for (let i = 0; i < headerRow.length; i++) {
      const header = headerRow[i];
      const value = userRow[i];

      switch (header) {
        case 'LINE User ID':
          profile.lineUserId = value;
          break;
        case 'User ID':
          profile.userId = value;
          break;
        case 'PDPA Consent':
          profile.pdpaConsent = value;
          break;
        case 'ชื่อ-นามสกุล':
          profile.fullName = value;
          profile.name = value;
          break;
        case 'เบอร์ติดต่อ':
          profile.phoneNumber = value;
          break;
        case 'เพศ':
          profile.gender = value;
          break;
        case 'ช่วงอายุ':
          profile.ageRange = value;
          profile.age = value;
          break;
        case 'ประเภทผู้ใช้งาน':
          profile.userType = value;
          profile.type = value;
          break;
        case 'ตำบล':
          profile.subdistrict = value;
          break;
        case 'อาชีพ':
          profile.occupation = value;
          break;
        case 'วันที่สมัคร':
          profile.registrationDate = value;
          break;
      }
    }

    Logger.log('Profile mapped:', JSON.stringify(profile));
    Logger.log('SUCCESS! User found:', profile.name);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: profile
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('ERROR in getUser:', error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
