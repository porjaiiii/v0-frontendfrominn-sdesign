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
  { id: 1, name: 'น้ำยาล้างจาน ซันไลต์', description: 'น้ำยาล้างจาน ชนิดเติม 500 ml', points: 25, image: '/images/rewards/sunlight-dish-soap.jpg'  },
  { id: 2, name: 'น้ำส้มควันไม้ สูตรเข้มข้น', description: '1 ลิตร', points: 50, image: '/images/rewards/wood-vinegar.jpg' },
  { id: 3, name: 'ถ่านไบโอชาร์', description: '1 กิโลกรัม', points: 50, image: '/images/rewards/biochar.jpg' },
  { id: 4, name: 'ข้าวหอมมะลิ', description: '1 กิโลกรัม', points: 55, image: '/images/rewards/one-kg-jasmine-rice.jpg' },
  { id: 5, name: 'น้ำมันพืช', description: '1 ลิตร 1 ขวด', points: 70, image: '/images/rewards/vegetable-oil.jpg' },
  { id: 6, name: 'ข้าวหอมมะลิ', description: '5 กิโลกรัม', points: 150, image: '/images/rewards/five-kg-jasmine-rice.jpg' },
  { id: 7, name: 'ทองคำแท้หนึ่งสลึง', description: 'ทองคำแผ่นหรือทองรูปพรรณ (ราคาปัจจุบัน)', points: 17000, image: '/images/rewards/gold-one-salung.png' }
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
