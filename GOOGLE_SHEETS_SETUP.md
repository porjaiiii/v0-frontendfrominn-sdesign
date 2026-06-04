# Google Sheets Integration - ระบบบันทึกขยะ

## ขั้นตอนการตั้งค่า (ง่าย ๆ เพียง 2 ขั้น)

### 1. สร้าง Google API Key

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com)
2. สร้าง Project ใหม่ (หรือใช้ที่มีอยู่)
3. Enable Google Sheets API:
   - ไปที่ "APIs & Services" > "Enable APIs and Services"
   - ค้นหา "Google Sheets API"
   - คลิก "Enable"
4. สร้าง API Key:
   - ไปที่ "APIs & Services" > "Credentials"
   - คลิก "Create Credentials" > "API Key"
   - คัดลอก API Key

### 2. แชร์ Google Sheet กับบัญชี Google

1. เปิด Google Sheet ของคุณ: `1SK_Nat8jb3iQWt-Gs_YUimycxMTcubV5ViD_QtqkO78`
2. คลิก "Share" ที่มุมขวาบน
3. ใช้ API Key ที่สร้างแล้ว (ไม่ต้องแชร์เพิ่มเติม API Key สามารถเข้าถึง public sheets ได้)

### 3. ตั้ง Environment Variable

เพิ่มลงในไฟล์ `.env.local` ของคุณ:

```
GOOGLE_SHEETS_API_KEY=AIzaSyDlu1nHAGq7-u6AMARFvMYA1OGVS-MeKdQ
```

## API Endpoints

### POST /api/waste/submit
บันทึกข้อมูลขยะใหม่

**Request Body:**
```json
{
  "user_id": "line_user_id",
  "waste_type": "plastic|paper|glass|aluminum|oil",
  "waste_subtype": "pet|hdpe|ldpe|pp|...",
  "weight_kg": 1.5,
  "image_url": "https://...",
  "notes": "หมายเหตุ"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2026-06-04T...",
    "user_id": "line_user_id",
    "waste_type": "plastic",
    "weight_kg": 1.5,
    "carbon_reduction": 3.75,
    "points_earned": 38
  }
}
```

### GET /api/waste/records
ดึงบันทึกขยะทั้งหมด หรือของ user เฉพาะ

**Query Parameters:**
- `user_id` (optional): ดึงเฉพาะบันทึกของผู้ใช้คนนี้

**Response:**
```json
{
  "records": [
    {
      "timestamp": "2026-06-04T...",
      "user_id": "line_user_id",
      "waste_type": "plastic",
      "waste_subtype": "pet",
      "weight_kg": 1.5,
      "image_url": "https://...",
      "carbon_reduction": 3.75,
      "points_earned": 38,
      "status": "pending",
      "notes": ""
    }
  ],
  "stats": {
    "total_records": 5,
    "total_weight": 7.5,
    "total_carbon": 18.75,
    "total_points": 188
  }
}
```

## Carbon Reduction Factors

| ประเภท | Factor |
|------|--------|
| plastic | 2.5 kg CO2/kg |
| paper | 1.8 kg CO2/kg |
| glass | 0.8 kg CO2/kg |
| aluminum | 4.0 kg CO2/kg |
| oil | 3.0 kg CO2/kg |

## ตัวอย่าง Frontend Usage

```typescript
// บันทึกขยะ
const response = await fetch('/api/waste/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: 'user_line_id',
    waste_type: 'plastic',
    waste_subtype: 'pet',
    weight_kg: 1.5,
  })
})

// ดึงข้อมูล
const response = await fetch('/api/waste/records?user_id=user_line_id')
const data = await response.json()
console.log(data.stats) // สถิติของผู้ใช้
```

เท่านี้ก็เสร็จแล้ว! ไม่ต้องสร้าง Service Account ซับซ้อน 😊
