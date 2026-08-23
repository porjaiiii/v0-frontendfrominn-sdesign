// ==========================================
// ตัวแปร Global
// ==========================================
const SHEET_NAME = 'coupons'; // จากโค้ดชุดที่ 3 (ระบบคูปอง)
const SHEET_NAME2 = 'submission'; // จากโค้ดชุดที่ 3 (ระบบคูปอง)
const ADMIN_SHEET_NAME = 'AdminKeys';

// ==========================================
// ฟังก์ชันหลักดักจับ HTTP POST (รวมทั้ง 3 ระบบ)
// ==========================================
function doPost(e) { 
  try { 
    Logger.log('===== REQUEST RECEIVED =====');
    Logger.log('Timestamp:', new Date().toISOString());
    
    // ดึงข้อมูลและสร้างตัวแปรให้รองรับทั้ง data (โค้ดชุดแรก, ชุดสาม) และ payload (โค้ดชุดที่สอง)
    const jsonString = e.postData.contents;
    const payload = JSON.parse(jsonString);
    const data = payload; 
    const action = data.action;
    
    Logger.log('Parsed payload:', JSON.stringify(payload, null, 2));
    Logger.log('Received action: ' + action);
    
    // กำหนด sheet สำหรับโค้ดชุดแรกที่ดึงจาก ActiveSheet
    const sheet =  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME2);
    
    // ----------------------------------------
    // ส่วนที่ 1: ระบบจัดการขยะและอัปโหลดรูปภาพ
    // ----------------------------------------
    
    // Case: Upload Image to Google Drive 
    if (action === 'uploadImage') { 
      Logger.log('[v0] Processing uploadImage action') 
      const result = uploadImageToDrive(data.base64Data, data.fileName, data.userId) 
      Logger.log('[v0] uploadImage result: ' + JSON.stringify(result)) 
      
      return ContentService.createTextOutput(JSON.stringify(result)) 
                           .setMimeType(ContentService.MimeType.JSON) 
    } 
    
    // Case: Get Records 
    if (action === 'getRecords') { 
      const allData = sheet.getDataRange().getValues() 
      const records = allData.slice(1) 
      
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        records: records, 
        stats: { 
          total: records.length, 
          pending: records.filter(r => r[8] === 'pending').length 
        } 
      })).setMimeType(ContentService.MimeType.JSON) 
    } 
    
    // Case: Submit Waste (สร้างรายการใหม่เริ่มต้นเป็น pending) 
    if (action === 'submitWaste') { 
     var rawImg = data.image_urls || data.image_url || '';
  

     var imageJson = (Array.isArray(rawImg) || typeof rawImg === 'object') ? JSON.stringify(rawImg) : rawImg;

      sheet.appendRow([ 
        data.timestamp, 
        data.user_id, 
        data.waste_type, 
        data.waste_subtype, 
        data.weight_kg, 
        imageJson, // บันทึกเป็น Array ลงคอลัมน์ F
        data.carbon_reduction, 
        data.points_earned, 
        'pending', 
        data.notes || '' 
      ]) 
      
      Logger.log('[v0] Waste record saved') 
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        message: 'Waste record saved' 
      })).setMimeType(ContentService.MimeType.JSON) 
    } 

    // Case Update Waste 
    if (action === 'updateWaste') { 
      Logger.log('[v0] Processing updateWaste action for user: ' + data.user_id) 
      
      const allRows = sheet.getDataRange().getValues() 
      let targetRowIndex = -1 
      
      for (let i = 1; i < allRows.length; i++) { 
        const row = allRows[i] 
        if (row[0].toString() === data.timestamp.toString() && row[1].toString() === data.user_id.toString()) { 
          targetRowIndex = i + 1 
          break 
        } 
      } 
      
      if (targetRowIndex === -1) { 
        Logger.log('[v0] Record not found for timestamp: ' + data.timestamp) 
        return ContentService.createTextOutput(JSON.stringify({ 
          success: false, 
          error: 'Record not found to update' 
        })).setMimeType(ContentService.MimeType.JSON) 
      } 
      sheet.getRange(targetRowIndex, 1).setValue(new Date())
 
      sheet.getRange(targetRowIndex, 3).setValue(data.waste_type) 
      sheet.getRange(targetRowIndex, 4).setValue(data.waste_subtype) 
      sheet.getRange(targetRowIndex, 5).setValue(data.weight_kg) 
      var rawImgUpdate = data.image_urls || data.image_url;
if (rawImgUpdate) {
  var imageJsonUpdate = (Array.isArray(rawImgUpdate) || typeof rawImgUpdate === 'object') ? JSON.stringify(rawImgUpdate) : rawImgUpdate;
  sheet.getRange(targetRowIndex, 6).setValue(imageJsonUpdate);
}
      

      sheet.getRange(targetRowIndex, 7).setValue(data.carbon_reduction) 
      sheet.getRange(targetRowIndex, 8).setValue(data.points_earned) 
      sheet.getRange(targetRowIndex, 9).setValue(data.status || 'done') 
      sheet.getRange(targetRowIndex, 10).setValue(data.notes || '') 
      
      Logger.log('[v0] Waste record updated successfully at row ' + targetRowIndex) 
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        message: 'Waste record updated successfully', 
        row_updated: targetRowIndex 
      })).setMimeType(ContentService.MimeType.JSON) 
    } 

    // ----------------------------------------
    // ส่วนที่ 2: ระบบสมาชิก 
    // ----------------------------------------
    
    if (action === 'registerUser') {
      return registerUser(payload);
    } else if (action === 'getUser') {
      return getUser(payload);
    } else if (action === 'updateUser') { 
      return updateUser(payload);
    }

    // ----------------------------------------
    // ส่วนที่ 3: ระบบคูปอง (คูปอง Action)
    // ----------------------------------------
    if (action === 'redeem') {
      return handleRedeem(data.coupon);
    } else if (action === 'use') {
      return handleUseCoupon(data.coupon_id, data.scanned_by);
    }

    // ----------------------------------------
    // กรณีที่หา Action ไม่เจอ (Unknown Action)
    // ----------------------------------------
    
    Logger.log('ERROR: Unknown action:', action);
    // ผสานการ Return Error ให้ใช้โครงสร้างจากระบบคูปอง
    return createResponse({ 
      status: 'error', 
      success: false,
      message: 'Invalid action or Unknown action: ' + action 
    }, 400);

  } catch (error) { 
    Logger.log('ERROR in doPost:', error.toString());
    return createResponse({ 
      status: 'error', 
      success: false,
      message: error.toString() 
    }, 500);
  } 
} 

// ==========================================
// ฟังก์ชันหลักสำหรับรับ HTTP GET (ระบบคูปอง)
// ==========================================

function doGet(e) {
  try {
    if (!e || !e.parameter) {
      return createResponse({ status: 'error', reason: 'NO_PARAMETERS_PROVIDED' }, 400);
    }

    const action = e.parameter.action;

    // จังหวะที่ 1: ตรวจสอบผ่านระบบ Switch Case (ถ้าฝั่งหน้าบ้านระบุ ?action=... มา)
    switch (action) {
      case 'verifyAdminKey':
        return handleVerifyAdminKey(e.parameter.adminKey, e.parameter.userId);
      case 'getByUserId':
        return handleGetByUserId(e.parameter.user_id);
      case 'getByCouponId':
        return handleGetByCouponId(e.parameter.coupon_id);
    }

    // จังหวะที่ 2: Fallback (ถ้าหน้าบ้านไม่ได้ส่ง action มา แต่ส่ง user_id หรือ coupon_id มาตรงๆ)
    const userId = e.parameter.user_id;
    const couponId = e.parameter.coupon_id;

    if (userId) {
      return handleGetByUserId(userId);
    } else if (couponId) {
      return handleGetByCouponId(couponId);
    } else {
      return createResponse({ status: 'error', message: 'Missing parameters or invalid action' }, 400);
    }

  } catch (error) {
    return createResponse({ status: 'error', message: error.toString() }, 500);
  }
}

// ==========================================
// LOGIC FUNCTIONS (ระบบคูปอง โค้ดชุดที่ 3)
// ==========================================

// 1. POST /api/coupons/redeem (สร้าง Coupon ใหม่)
function handleRedeem(coupon) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  
  // จัดเรียงข้อมูลให้ตรงกับ Column ใน Sheet
  const rowData = [
    coupon.coupon_id,
    coupon.user_id,
    coupon.reward_id,
    coupon.reward_name,
    coupon.reward_description,
    coupon.reward_image,
    coupon.points_used,
    coupon.tx_id || '',
    coupon.status || 'active',
    coupon.redeemed_at || new Date().toISOString(),
    coupon.used_at || '',
    coupon.expires_at || '',
    coupon.scanned_by || ''
  ];
  
  sheet.appendRow(rowData);
  return createResponse({ status: 'success', message: 'Coupon redeemed successfully' });
}

// 2. POST /api/coupons/use (มาร์คว่าใช้แล้วเมื่อสแกน QR)
function handleUseCoupon(couponId, scannedBy) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  // ค้นหาแถวที่มี coupon_id ตรงกัน (เริ่มหาตั้งแต่แถวที่ 2 ข้าม Header)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === couponId) {
      if (data[i][8] === 'used') {
        return createResponse({ status: 'error', message: 'Coupon already used' }, 400);
      }
      
      const rowNum = i + 1;
      sheet.getRange(rowNum, 9).setValue('used'); // Column I: status
      sheet.getRange(rowNum, 11).setValue(new Date().toISOString()); // Column K: used_at
      sheet.getRange(rowNum, 13).setValue(scannedBy || 'staff'); // Column M: scanned_by
      
      return createResponse({ status: 'success', message: 'Coupon marked as used' });
    }
  }
  
  return createResponse({ status: 'error', message: 'Coupon not found' }, 404);
}

// 3. GET /api/coupons?user_id=xxx (ดึงคูปองทั้งหมดของ User)
function handleGetByUserId(userId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const userCoupons = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === userId) { // Column 2: user_id
      userCoupons.push(rowToObject(headers, data[i]));
    }
  }
  
  return createResponse({ status: 'success', data: userCoupons });
}

// 4. GET /api/coupons/[id] (ดึงคูปองเดี่ยวตาม ID)
function handleGetByCouponId(couponId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === couponId) { // Column 1: coupon_id
      const couponObj = rowToObject(headers, data[i]);
      return createResponse({ status: 'success', data: couponObj });
    }
  }
  
  return createResponse({ status: 'error', message: 'Coupon not found' }, 404);
}

// ----------------------------------------
// HELPER FUNCTIONS (ระบบคูปอง)
// ----------------------------------------

// แปลง Array ของแถวใน Sheet ให้เป็น JSON Object ตามชื่อ Header
function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index];
  });
  return obj;
}

// สร้าง HTTP Response กลับไปยัง Next.js API
function createResponse(body, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
    
  // หมายเหตุ: Apps Script Web App ไม่สามารถเปลี่ยน HTTP Status Code ได้ตรงๆ 
  // จึงนิยมส่ง statusCode ไปในตัว JSON Payload ด้วยเพื่อความสะดวกในการเช็คฝั่ง Client
  return output;
}

// ==========================================
// HELPER FUNCTIONS (ระบบจัดการขยะและรูป โค้ดชุดที่ 1)
// ==========================================

function uploadImageToDrive(base64Data, fileName, userId) { 
  try { 
    const GOOGLE_DRIVE_FOLDER_ID = '1r-4RqxmTFL8JQQb3b_16jrxPz77Zgq10' 
    
    Logger.log('[v0] Starting image upload: ' + fileName) 
    
    let cleanBase64 = base64Data; 
    if (base64Data.indexOf(',') !== -1) { 
      cleanBase64 = base64Data.split(',')[1]; 
    } 
    
    const byteCharacters = Utilities.base64Decode(cleanBase64) 
    const blob = Utilities.newBlob(byteCharacters, 'image/jpeg', fileName) 
    
    const rootFolder = DriveApp.getFolderById(GOOGLE_DRIVE_FOLDER_ID) 
    const userFolderName = 'user_' + userId 
    
    let userFolder 
    const userFolders = rootFolder.getFoldersByName(userFolderName) 
    
    if (userFolders.hasNext()) { 
      userFolder = userFolders.next() 
    } else { 
      userFolder = rootFolder.createFolder(userFolderName) 
    } 
    
    const file = userFolder.createFile(blob) 
    const fileId = file.getId() 
    const imageUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000' 
    
    Logger.log('[v0] Image uploaded successfully: ' + imageUrl) 
    
    return { 
      success: true, 
      imageUrl: imageUrl,   
      image_url: imageUrl,   
      fileName: fileName, 
      fileId: fileId 
    } 
  } catch (error) { 
    Logger.log('[v0] Error uploading image: ' + error.message) 
    return { 
      success: false, 
      error: error.message 
    } 
  } 
} 

// ==========================================
// HELPER FUNCTIONS (ระบบสมาชิก โค้ดชุดที่ 2)
// ==========================================

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
        case 'ชื่อเล่น': 
          value = payload.nickname || '';
          break;
       case 'เบอร์ติดต่อ':
          value = payload.phoneNumber ? "'" + payload.phoneNumber : ''; 
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
        case 'ที่อยู่': 
          value = payload.address || '';
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
    
    const lineUserIdColumnIndex = headerRow.findIndex(h => h === 'LINE User ID');
    
    if (lineUserIdColumnIndex === -1) {
      Logger.log('ERROR: LINE User ID column not found. Headers:', JSON.stringify(headerRow));
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'LINE User ID column not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }

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
        case 'ชื่อเล่น': 
          profile.nickname = value;
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
        case 'ที่อยู่': 
          profile.address = value;
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
function testAuthorization() {
  // คำสั่งนี้จะบังคับให้สคริปต์พยายามเข้าถึงไฟล์
  // ถ้ายังไม่ได้รับสิทธิ์ ระบบจะเด้งหน้าต่างขอสิทธิ์ให้คุณยืนยันทันทีครับ
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  Logger.log("เข้าถึงได้แล้ว: " + sheet.getName());
  var folder = DriveApp.getRootFolder();
  Logger.log("เข้าถึงไดรฟ์สำเร็จ: " + folder.getName());
}

function updateUser(payload) {
  try {
    Logger.log('===== UPDATE USER =====');
    
    if (!payload.lineUserId) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'lineUserId is required for update' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Registration');
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    const headerRow = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    
    const lineUserIdColumnIndex = headerRow.indexOf('LINE User ID');
    const data = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
    
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][lineUserIdColumnIndex] === payload.lineUserId) {
        rowIndex = i + 1; // +1 เพราะแถวเริ่มที่ 1
        break;
      }
    }

    if (rowIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'User not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    for (let i = 0; i < headerRow.length; i++) {
      const header = headerRow[i];
      let newValue = null;

      switch (header) {
        case 'ชื่อ-นามสกุล': if(payload.fullName) newValue = payload.fullName; break;
        case 'ชื่อเล่น': if(payload.nickname) newValue = payload.nickname; break;
        case 'เบอร์ติดต่อ': 
          if(payload.phoneNumber) newValue = "'" + payload.phoneNumber; 
          break;
        case 'เพศ': if(payload.gender) newValue = payload.gender; break;
        case 'ช่วงอายุ': if(payload.ageRange) newValue = payload.ageRange; break;
        case 'ประเภทผู้ใช้งาน': if(payload.userType) newValue = payload.userType; break;
        case 'ที่อยู่': if(payload.address) newValue = payload.address; break;
        case 'ตำบล': if(payload.subdistrict) newValue = payload.subdistrict; break;
        case 'อาชีพ': if(payload.occupation) newValue = payload.occupation; break;
      }

      if (newValue !== null) {
        sheet.getRange(rowIndex, i + 1).setValue(newValue);
      }
    }

    Logger.log('SUCCESS! User updated at row: ' + rowIndex);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Updated successfully'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
//function ADMIN
function handleVerifyAdminKey(adminKey, userId) {
  if (!adminKey || !userId) {
    return createResponse({ status: 'error', reason: 'MISSING_PARAMS' }, 400);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // 💡 ดึงชีต Admin ด้วย getSheetByName
  const sheet = ss.getSheetByName(ADMIN_SHEET_NAME);

  if (!sheet) {
    return createResponse({ status: 'error', reason: 'SHEET_NOT_FOUND' }, 500);
  }

  const data = sheet.getDataRange().getValues();

  // วนหาจากแถวที่ 2 (ข้าม header)
  for (let i = 1; i < data.length; i++) {
    const rowKey    = String(data[i][0]).trim();
    const rowStatus = String(data[i][1]).trim().toLowerCase();
    const rowUserId = String(data[i][2]).trim();

    if (rowKey !== String(adminKey).trim()) continue;

    // เจอ key แล้ว
    if (rowStatus === 'active') {
      if (rowUserId === userId) {
        return createResponse({ status: 'success', message: 'Already activated by this user' });
      } else {
        return createResponse({ status: 'error', reason: 'KEY_TAKEN' }, 403);
      }
    }

    // key ยังไม่เคยถูกผูก → activate
    const rowNum = i + 1;
    sheet.getRange(rowNum, 2).setValue('active');                 // Column B: status
    sheet.getRange(rowNum, 3).setValue(userId);                   // Column C: line_user_id
    sheet.getRange(rowNum, 4).setValue(new Date().toISOString()); // Column D: activated_at

    return createResponse({ status: 'success', message: 'Key activated successfully' });
  }

  return createResponse({ status: 'error', reason: 'KEY_INVALID' }, 404);
}