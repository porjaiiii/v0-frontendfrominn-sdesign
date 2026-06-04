# การตั้งค่า Google Sheets API - คำแนะนำทีละขั้นตอน

## ขั้นตอนที่ 1: สร้าง Service Account ใน Google Cloud

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. สร้าง Project ใหม่:
   - คลิก "เลือกโปรเจ็กต์" > "NEW PROJECT"
   - ตั้งชื่อว่า "Waste Tracking"
   - คลิก "CREATE"

3. เปิด Google Sheets API:
   - ค้นหา "Google Sheets API" ในช่องค้นหา
   - คลิก > "ENABLE"

4. สร้าง Service Account:
   - ไปที่ "APIs & Services" > "Credentials"
   - คลิก "Create Credentials" > "Service Account"
   - ตั้งชื่อ: "Waste Tracking App"
   - คลิก "Create and Continue"
   - ข้ามขั้นตอนอื่นและคลิก "Done"

5. สร้าง JSON Key:
   - คลิก Service Account ที่สร้าง
   - ไปที่ "Keys" > "Add Key" > "Create new key"
   - เลือก "JSON"
   - ระบบจะดาวน์โหลด JSON file โดยอัตโนมัติ

## ขั้นตอนที่ 2: แชร์ Google Sheet กับ Service Account

1. เปิด Google Sheet ที่คุณสร้าง
2. คลิก "Share"
3. คัดลอก email จาก JSON file (ฟิลด์ "client_email")
   - ตัวอย่าง: `waste-tracking@PROJECT_ID.iam.gserviceaccount.com`
4. วาง email นั้นลงในช่อง "Add people and groups"
5. ให้สิทธิ์ "Editor"
6. คลิก "Share"

## ขั้นตอนที่ 3: ตั้ง Environment Variables

1. เปิด JSON file ที่ดาวน์โหลด
2. ค้นหาฟิลด์ต่อไปนี้:
   - `client_email` → ใช้สำหรับ `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → ใช้สำหรับ `GOOGLE_PRIVATE_KEY`

3. เพิ่มไปใน `.env.local` ของโปรเจ็กต์:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=waste-tracking@PROJECT_ID.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**หมายเหตุ:** ต้องใช้ `\n` แทนการขึ้นบรรทัดใหม่

## ขั้นตอนที่ 4: ทดสอบ API

### บันทึกขยะ

```bash
curl -X POST http://localhost:3000/api/waste/submit \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "U1234567890",
    "waste_type": "plastic",
    "waste_subtype": "pet",
    "weight_kg": 2.5,
    "carbon_reduction": 6.25,
    "points_earned": 62.5,
    "image_url": "https://example.com/image.jpg",
    "notes": "ขวดน้ำใสพลาสติก"
  }'
```

### ดึงบันทึกขยะ

```bash
# ดึงทั้งหมด
curl http://localhost:3000/api/waste/records

# ดึงเฉพาะผู้ใช้ specific
curl http://localhost:3000/api/waste/records?user_id=U1234567890

# ดึงสถิติ
curl http://localhost:3000/api/waste/records?user_id=U1234567890&action=stats
```

## API Endpoints

### POST `/api/waste/submit`
บันทึกข้อมูลขยะใหม่

**Request Body:**
```json
{
  "user_id": "string (line_userid)",
  "waste_type": "plastic|paper|glass|aluminum|oil",
  "waste_subtype": "string",
  "weight_kg": "number",
  "carbon_reduction": "number",
  "points_earned": "number",
  "image_url": "string (optional)",
  "notes": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Waste record submitted successfully",
  "data": { ... }
}
```

### GET `/api/waste/records`
ดึงบันทึกขยะ

**Query Parameters:**
- `user_id` (optional) - กรองเฉพาะผู้ใช้
- `action=stats` - คำนวณสถิติ (ต้องมี user_id)

## การคำนวณคาร์บอนและคะแนน

สูตร:
```
carbon_reduction = weight_kg × carbon_factor
points_earned = carbon_reduction × 10
```

**Carbon Factors:**
- พลาสติก: 2.5 kg CO2/kg
- กระดาษ: 1.8 kg CO2/kg
- แก้ว: 0.8 kg CO2/kg
- อลูมิเนียม: 4.0 kg CO2/kg
- น้ำมัน: 3.0 kg CO2/kg

## การแปลง JSON Key

ถ้า JSON key มี error เกี่ยวกับ newline:

```javascript
// เปลี่ยน
"-----BEGIN PRIVATE KEY-----\nABC...\nXYZ...\n-----END PRIVATE KEY-----\n"

// เป็น
"-----BEGIN PRIVATE KEY-----\\nABC...\\nXYZ...\\n-----END PRIVATE KEY-----\\n"
```

---

**ตอนอื่นแล้ว** ให้บอกผมว่าทำขั้นตอนไหนเสร็จแล้ว พร้อม:
- Google Cloud Project ID
- Service Account Email
- หรืออัพโหลด JSON file
