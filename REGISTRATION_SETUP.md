# ระบบลงทะเบียน Digital Wasted Account

## ขั้นตอนการติดตั้ง

### 1. สร้าง Google Sheet สำหรับ Registration

1. ไปที่ https://sheets.google.com
2. สร้าง Google Sheet ใหม่ (ตั้งชื่อว่า เช่น "Digital Wasted Registration")
3. เพิ่มคอลัมน์หัวดังนี้:
   - LINE User ID
   - User ID
   - PDPA Consent
   - ชื่อ-นามสกุล
   - เบอร์ติดต่อ
   - เพศ
   - ช่วงอายุ
   - ประเภทผู้ใช้งาน
   - ตำบล
   - อาชีพ
   - วันที่สมัคร

### 2. ติดตั้ง Google Apps Script

1. ใน Google Sheet ให้คลิก **ส่วนขยาย** > **Apps Script**
2. ลบโค้ดเดิมออก
3. คัดลอกโค้ดจากไฟล์ `google-apps-script.js` ไปวาง
4. บันทึกโปรเจค (Ctrl+S หรือ Cmd+S)
5. คลิก **Deploy** > **New deployment**
6. เลือก **Type: Web app**
7. ตั้ง:
   - Execute as: บัญชีของคุณ
   - Who has access: Anyone
8. คลิก **Deploy**
9. คัดลอก **Deployment URL** ที่ปรากฏขึ้น

### 3. ตั้งค่า Environment Variable

ในโปรเจค Next.js ของคุณ ให้เพิ่ม Environment Variable:

```env
GOOGLE_APPS_SCRIPT_REGISTER_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/usercontent
```

แทน `YOUR_DEPLOYMENT_ID` ด้วย ID จากขั้นตอนที่ 2

### 4. เพิ่ม Link ไปหน้า Registration

ในการนำทาง sidebar หรือ header ของคุณ ให้เพิ่ม:

```tsx
<Link href="/register">ลงทะเบียน</Link>
```

## การใช้งาน

### หน้า Registration

- URL: `/register`
- ผู้ใช้สามารถกรอกข้อมูลลงทะเบียน
- ข้อมูลจะถูกส่งไปยัง Google Sheet อัตโนมัติ
- ข้อมูลที่จำเป็น: LINE User ID, ชื่อ-นามสกุล, เบอร์ติดต่อ, เพศ, ช่วงอายุ, PDPA Consent

## API Endpoints

### POST /api/register

ส่งข้อมูลการลงทะเบียนไปยัง Google Sheet

Request body:
```json
{
  "lineUserId": "U1234567890...",
  "userId": "user123",
  "fullName": "สมชาย สมการ",
  "phoneNumber": "0812345678",
  "gender": "ชาย",
  "ageRange": "21-30 ปี",
  "userType": "บุคคลทั่วไป",
  "subdistrict": "ท่าน้ำ",
  "occupation": "นักเรียน",
  "pdpaConsent": "ยอมรับ",
  "registrationDate": "9/6/2026"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "lineUserId": "U1234567890...",
    "fullName": "สมชาย สมการ",
    "registrationDate": "9/6/2026"
  }
}
```

## Troubleshooting

### Error: "Sheet 'Registration' not found"

- ตรวจสอบว่าชีตชื่อ "Registration" มีอยู่ใน Google Sheet
- ชื่อต้องตรงกันทุกประการ (case-sensitive สำหรับภาษาอังกฤษ)

### Error: "Failed to save to Google Sheet"

- ตรวจสอบ URL ของ Google Apps Script
- ตรวจสอบว่า Deployment ได้รับการติดตั้งเป็น "Web app" และ "Anyone" สามารถเข้าถึงได้

### ข้อมูลไม่ปรากฏใน Google Sheet

- ตรวจสอบ Apps Script Logs โดยไปที่ Apps Script Editor > Logs
- ตรวจสอบชื่อคอลัมน์ใน Sheet ต้องตรงกับที่กำหนดในโค้ด

## Notes

- ระบบปัจจุบันรองรับทั้ง Registration และ Waste Records บน Google Sheet เดียวกัน
- ใช้ชีต "Registration" สำหรับข้อมูลการลงทะเบียน
- ใช้ชีต "Waste Records" สำหรับบันทึกการบริจาคขยะ
