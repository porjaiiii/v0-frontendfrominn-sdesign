import { type WasteType, type WasteSubType } from '@/lib/app-context'

export const WASTE_TYPES: { id: WasteType; name: string; icon: string }[] = [
  { id: 'plastic', name: 'พลาสติก', icon: '/images/waste/plastic.svg' },
  { id: 'paper', name: 'กระดาษ', icon: '/images/waste/paper.svg' },
  { id: 'glass', name: 'แก้ว', icon: '/images/waste/glass.svg' },
  { id: 'aluminum', name: 'อลูมิเนียม', icon: '/images/waste/aluminum.svg' },
]

export const WASTE_SUBTYPES: Record<WasteType, WasteSubType[]> = {
  plastic: [
    { id: 'pet', name: 'ขวดน้ำพลาสติกใส', description: '(PET)', image: '/images/waste/plastic-pet.svg' },
    { id: 'hdpe', name: 'ขวดน้ำพลาสติกขุ่น', description: '(HDPE)', image: '/images/waste/plastic-hdpe.svg' },
    { id: 'ldpe', name: 'ฝาขวดน้ำพลาสติก', description: '(HDPE)', image: '/images/waste/plastic-ldpe.svg' },
    // { id: 'pp', name: 'ถุงพลาสติก', description: '(LDPE)', image: '/images/waste/plastic-pp.svg' },
  ],
  paper: [
    { id: 'cardboard', name: 'กระดาษลัง', image: '/images/waste/paper-cardboard.svg' },
    { id: 'a4', name: 'กระดาษสีขาว/(A4)', image: '/images/waste/paper-mixed-paper.svg' },
    { id: 'mixed', name: 'กระดาษนิตยสาร\nหนังสือพิมพ์', image: '/images/waste/paper-newspaper.svg' },
  ],
  glass: [
    { id: 'clear', name: 'ขวดแก้วชนิดเดียวกัน/\nครบลัง', image: '/images/waste/glass-clear.svg' },
    { id: 'colored', name: 'ขวดแก้วรวม', image: '/images/waste/glass-colored.svg' },
  ],
  aluminum: [
    { id: 'can', name: 'กระป๋องอลูมิเนียม', image: '/images/waste/aluminum-can.svg' },
    { id: 'plate', name: 'ฝาอลูมิเนียม', image: '/images/waste/aluminum-plate.svg' },
    { id: 'scrap', name: 'เศษอลูมิเนียม', image: '/images/waste/aluminum-scrap.svg' },
  ],
  oil: [
    { id: 'cooking', name: 'น้ำมันพืชใช้แล้ว', image: '/images/waste/oil-cooking.svg' },
    { id: 'motor', name: 'น้ำมันเครื่องใช้แล้ว', image: '/images/waste/oil-motor.svg' },
  ],  
}

export const REWARDS = [
  // --- ข้อมูลเดิมของท่าน (4 อย่าง) ---
  { id: 1, name: 'มาม่า รสแซ่บ', description: 'แพ็ก 5 ซอง', points: 30, image: '/images/rewards/mama.jpg' },
  { id: 2, name: 'ไข่ไก่สด (เบอเล็ก)', description: 'แพ็ก 10 ฟอง', points: 37, image: '/images/rewards/eggs.jpg' },
  { id: 3, name: 'ข้าวสารขาว (เสาไห้)', description: 'ถุง 5 กิโลกรัม', points: 110, image: '/images/rewards/rice-white.jpg' },
  { id: 4, name: 'ข้าวหอมมะลิ 100%', description: 'ถุง 5 กิโลกรัม', points: 200, image: '/images/rewards/rice-jasmine.jpg' },

  // --- เพิ่มเติมจาก Sheet รวมเป็น 15 อย่าง ---
  // Tier 1
  { id: 5, name: 'ปรุงทิพย์เกลือป่น', description: 'ขนาด 500 กรัม', points: 7, image: '/images/rewards/salt-prungthip.jpg' },
  { id: 6, name: 'สบู่ก้อน', description: 'สบู่ทำความสะอาดผิวกาย 1 ก้อน', points: 9, image: '/images/rewards/soap.jpg' },

  // Tier 2
  { id: 7, name: 'ผงปรุงรสฟ้าไทย', description: 'ขนาด 75 กรัม', points: 14, image: '/images/rewards/fahthai-seasoning.jpg' },
  { id: 8, name: 'นมไทยเดนมาร์ก', description: 'รสจืด ขนาด 250 มล.', points: 11, image: '/images/rewards/thai-denmark-milk.jpg' },
  { id: 9, name: 'ภูเขาทอง ซีอิ๊วขาว', description: 'ขนาด 200 มล.', points: 14, image: '/images/rewards/golden-mountain-soy-sauce.jpg' },
  { id: 10, name: 'ไลปอนเอฟ น้ำยาล้างจาน', description: 'ขนาด 450 มล.', points: 20, image: '/images/rewards/lipon-f.jpg' },

  // Tier 3
  { id: 11, name: 'ไฮเตอร์น้ำยาซักผ้าขาว', description: 'สีฟ้า ขนาด 600 ซีซี.', points: 29, image: '/images/rewards/haiter-blue.jpg' },
  { id: 12, name: 'ยาสีฟัน', description: 'สูตรฟันสะอาดสดชื่น 1 หลอด', points: 42, image: '/images/rewards/toothpaste.jpg' },

  // Tier 4
  { id: 13, name: 'คาราบาวแดง', description: 'เครื่องดื่มชูกำลัง แพ็ค 10 ขวด', points: 88, image: '/images/rewards/carabao-dang.jpg' },

  // Tier 5
  { id: 14, name: 'SHARP หม้อหุงข้าวชาร์ป', description: 'ขนาด 1.1 ลิตร รุ่น KSH-D11', points: 705, image: '/images/rewards/sharp-rice-cooker.jpg' },

  // Tier 6
  { id: 15, name: 'ทองคำแท้หนึ่งสลึง', description: 'ทองคำแผ่นหรือทองรูปพรรณ (ราคาปัจจุบัน)', points: 18600, image: '/images/rewards/gold-one-salung.png' }
]

export const LEADERBOARD = [
  { rank: 1, name: 'สมชาย ใจดี', carbon: 256.5, avatar: '/placeholder.svg?height=40&width=40&query=avatar1' },
  { rank: 2, name: 'สมหญิง รักษ์โลก', carbon: 234.3, avatar: '/placeholder.svg?height=40&width=40&query=avatar2' },
  { rank: 3, name: 'มนัส เกื้อกูล', carbon: 112.4, avatar: '/placeholder.svg?height=40&width=40&query=avatar3' },
  { rank: 4, name: 'กมลา ตาวุดีมี', carbon: 89, avatar: '/placeholder.svg?height=40&width=40&query=avatar4' },
  { rank: 5, name: 'สมหญิง รักษ์โลก', carbon: 78, avatar: '/placeholder.svg?height=40&width=40&query=avatar5' },
  { rank: 6, name: 'สมหญิง รักษ์โลก', carbon: 76, avatar: '/placeholder.svg?height=40&width=40&query=avatar6' },
  { rank: 7, name: 'สมหญิง รักษ์โลก', carbon: 74, avatar: '/placeholder.svg?height=40&width=40&query=avatar7' },
]
