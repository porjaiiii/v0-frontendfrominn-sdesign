// Google Apps Script for Digital Wasted Account Registration
// ขั้นตอนการติดตั้ง:
// 1. ไปที่ Google Sheet: https://sheets.google.com
// 2. สร้างชีทใหม่ สำหรับการลงทะเบียนผู้ใช้ (ตั้งชื่อว่า "Registration")
// 3. เพิ่มคอลัมน์หัว: LINE User ID, User ID, PDPA Consent, ชื่อ-นามสกุล, เบอร์ติดต่อ, เพศ, ช่วงอายุ, ประเภทผู้ใช้งาน, ตำบล, อาชีพ, วันที่สมัคร
// 4. ไปที่ "ส่วนขยาย" > "Apps Script"
// 5. ลบโค้ดเดิมและวางโค้ดด้านล่าง
// 6. บันทึกและติดตั้ง (Deploy) เป็น "Web app"
// 7. คัดลอก URL ของ Web app แล้วเพิ่มในตัวแปร GOOGLE_APPS_SCRIPT_REGISTER_URL ในโปรเจค

// สำหรับ Waste Records ใช้ชีท "Waste Records"
// สำหรับ Registration ใช้ชีท "Registration"

function doPost(e) {
  try {
    // Log ทันทีเพื่อดูว่า request มาถึงหรือไม่
    Logger.log('===== REQUEST RECEIVED =====');
    Logger.log('Request timestamp:', new Date().toISOString());
    Logger.log('Raw e.postData:', e.postData);
    
    const payload = JSON.parse(e.postData.contents);
    Logger.log('Parsed payload:', JSON.stringify(payload, null, 2));

    if (payload.action === 'registerUser') {
      Logger.log('ACTION: registerUser');
      return registerUser(payload);
    } else if (payload.action === 'submitWaste') {
      Logger.log('ACTION: submitWaste');
      return submitWaste(payload);
    }

    Logger.log('ERROR: Unknown action:', payload.action);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Unknown action: ' + payload.action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('===== ERROR IN doPost =====');
    Logger.log('Error message:', error.toString());
    Logger.log('Error stack:', error.stack);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString(),
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function registerUser(payload) {
  try {
    Logger.log('===== REGISTER USER START =====');
    
    // เปิด Google Sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log('Spreadsheet name:', ss.getName());
    Logger.log('Available sheets:', ss.getSheets().map(s => s.getName()));
    
    const sheet = ss.getSheetByName('Registration');
    
    if (!sheet) {
      Logger.log('ERROR: Sheet "Registration" not found!');
      const availableSheets = ss.getSheets().map(s => s.getName()).join(', ');
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Sheet "Registration" not found. Available sheets: ' + availableSheets
      })).setMimeType(ContentService.MimeType.JSON);
    }

    Logger.log('Sheet found:', sheet.getName());
    
    // ดึงแถวแรก (ส่วนหัว) เพื่อกำหนดคอลัมน์
    const lastColumn = sheet.getLastColumn();
    Logger.log('Last column:', lastColumn);
    
    const headerRow = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    Logger.log('Headers:', JSON.stringify(headerRow));

    // เพิ่มแถวใหม่
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
        default:
          value = '';
      }

      newRow.push(value);
      Logger.log('Column [' + header + ']: ' + value);
    }

    Logger.log('New row to append:', JSON.stringify(newRow));

    // ผนวกแถวใหม่
    sheet.appendRow(newRow);
    
    const newRowCount = sheet.getLastRow();
    Logger.log('Row appended! Total rows now:', newRowCount);
    Logger.log('===== REGISTER USER SUCCESS =====');

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Registration saved successfully',
      rowNumber: newRowCount,
      data: payload,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('===== ERROR IN REGISTER USER =====');
    Logger.log('Error message:', error.toString());
    Logger.log('Error stack:', error.stack);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString(),
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function submitWaste(payload) {
  try {
    // เปิด Google Sheet สำหรับบันทึกขยะ
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Waste Records');
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Sheet "Waste Records" not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ดึงแถวแรก (ส่วนหัว)
    const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // สร้าง object จาก header
    const columnMap = {};
    headerRow.forEach((header, index) => {
      columnMap[header] = index + 1;
    });

    // เพิ่มแถวใหม่
    const newRow = [];
    for (let i = 1; i <= sheet.getLastColumn(); i++) {
      const header = headerRow[i - 1];
      let value = '';

      switch (header) {
        case 'user_id':
        case 'User ID':
          value = payload.user_id || '';
          break;
        case 'waste_type':
        case 'Waste Type':
          value = payload.waste_type || '';
          break;
        case 'waste_subtype':
        case 'Waste Subtype':
          value = payload.waste_subtype || '';
          break;
        case 'weight_kg':
        case 'Weight (kg)':
          value = payload.weight_kg || '';
          break;
        case 'carbon_reduction':
        case 'Carbon Reduction':
          value = payload.carbon_reduction || '';
          break;
        case 'points_earned':
        case 'Points Earned':
          value = payload.points_earned || '';
          break;
        case 'image_url':
        case 'Image URL':
          value = payload.image_url || '';
          break;
        case 'notes':
        case 'Notes':
          value = payload.notes || '';
          break;
        case 'timestamp':
        case 'Timestamp':
          value = payload.timestamp || new Date().toISOString();
          break;
        default:
          value = '';
      }

      newRow.push(value);
    }

    // ผนวกแถวใหม่
    sheet.appendRow(newRow);

    Logger.log('Waste record submitted successfully for user:', payload.user_id);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Waste record saved successfully',
      data: payload
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error in submitWaste:', error);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
