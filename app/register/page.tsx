'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

const OCCUPATIONS = [
  'นักเรียน',
  'นักศึกษา',
  'พนักงานเอกชน',
  'ข้าราชการ',
  'เกษตรกร',
  'ผู้ประกอบการ',
  'อื่น ๆ',
]

const SUBDISTRICTS = [
  'ท่าน้ำ',
  'วัฒนา',
  'คลองเตย',
  'สถลา',
  'ดุสิต',
  'บ้านเก่า',
  'พญาไท',
  'อื่น ๆ',
]

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    lineUserId: '',
    userId: '',
    pdpaConsent: false,
    fullName: '',
    phoneNumber: '',
    gender: '',
    ageRange: '',
    userType: '',
    subdistrict: '',
    occupation: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Validate required fields
    if (!formData.lineUserId || !formData.fullName || !formData.phoneNumber || !formData.gender || !formData.ageRange || !formData.pdpaConsent) {
      setError('กรุณากรอกข้อมูลที่จำเป็นทั้งหมด')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lineUserId: formData.lineUserId,
          userId: formData.userId,
          pdpaConsent: formData.pdpaConsent ? 'ยอมรับ' : 'ไม่ยอมรับ',
          fullName: formData.fullName,
          phoneNumber: formData.phoneNumber,
          gender: formData.gender,
          ageRange: formData.ageRange,
          userType: formData.userType,
          subdistrict: formData.subdistrict,
          occupation: formData.occupation,
          registrationDate: new Date().toLocaleDateString('th-TH'),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to register')
      }

      setSuccess(true)
      setFormData({
        lineUserId: '',
        userId: '',
        pdpaConsent: false,
        fullName: '',
        phoneNumber: '',
        gender: '',
        ageRange: '',
        userType: '',
        subdistrict: '',
        occupation: '',
      })

      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลงทะเบียน')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#157b03] to-[#0d5002] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md w-full">
          <div className="w-12 h-12 bg-[#157b03] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#157b03] mb-2">ลงทะเบียนสำเร็จ</h2>
          <p className="text-gray-600">ยินดีต้อนรับสู่ Digital Wasted Account</p>
          <p className="text-sm text-gray-500 mt-4">กำลังเปลี่ยนไปยังหน้าหลัก...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#157b03] to-[#0d5002]">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900">ลงทะเบียน</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Form */}
      <div className="max-w-md mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* LINE User ID */}
          <div>
            <label className="block text-white font-medium mb-2">LINE User ID *</label>
            <input
              type="text"
              name="lineUserId"
              value={formData.lineUserId}
              onChange={handleChange}
              placeholder="LINE User ID"
              className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#157b03] outline-none"
              required
            />
          </div>

          {/* User ID */}
          <div>
            <label className="block text-white font-medium mb-2">User ID</label>
            <input
              type="text"
              name="userId"
              value={formData.userId}
              onChange={handleChange}
              placeholder="User ID"
              className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#157b03] outline-none"
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-white font-medium mb-2">ชื่อ-นามสกุล *</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="เช่น สมชาย สมการ"
              className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#157b03] outline-none"
              required
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-white font-medium mb-2">เบอร์ติดต่อ *</label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="เช่น 08xxxxxxxx"
              className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#157b03] outline-none"
              required
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-white font-medium mb-2">เพศ *</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#157b03] outline-none"
              required
            >
              <option value="">-- เลือกเพศ --</option>
              <option value="ชาย">ชาย</option>
              <option value="หญิง">หญิง</option>
              <option value="อื่น ๆ">อื่น ๆ</option>
            </select>
          </div>

          {/* Age Range */}
          <div>
            <label className="block text-white font-medium mb-2">ช่วงอายุ *</label>
            <select
              name="ageRange"
              value={formData.ageRange}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#157b03] outline-none"
              required
            >
              <option value="">-- เลือกช่วงอายุ --</option>
              <option value="ต่ำกว่า 15 ปี">ต่ำกว่า 15 ปี</option>
              <option value="15-20 ปี">15-20 ปี</option>
              <option value="21-30 ปี">21-30 ปี</option>
              <option value="31-40 ปี">31-40 ปี</option>
              <option value="41-50 ปี">41-50 ปี</option>
              <option value="51-60 ปี">51-60 ปี</option>
              <option value="มากกว่า 60 ปี">มากกว่า 60 ปี</option>
            </select>
          </div>

          {/* User Type */}
          <div>
            <label className="block text-white font-medium mb-2">ประเภทผู้ใช้งาน</label>
            <select
              name="userType"
              value={formData.userType}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#157b03] outline-none"
            >
              <option value="">-- เลือกประเภท --</option>
              <option value="บุคคลทั่วไป">บุคคลทั่วไป</option>
              <option value="ชุมชน">ชุมชน</option>
              <option value="องค์กร">องค์กร</option>
              <option value="อื่น ๆ">อื่น ๆ</option>
            </select>
          </div>

          {/* Subdistrict */}
          <div>
            <label className="block text-white font-medium mb-2">ตำบล</label>
            <select
              name="subdistrict"
              value={formData.subdistrict}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#157b03] outline-none"
            >
              <option value="">-- เลือกตำบล --</option>
              {SUBDISTRICTS.map(district => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
          </div>

          {/* Occupation */}
          <div>
            <label className="block text-white font-medium mb-2">อาชีพ</label>
            <select
              name="occupation"
              value={formData.occupation}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#157b03] outline-none"
            >
              <option value="">-- เลือกอาชีพ --</option>
              {OCCUPATIONS.map(occ => (
                <option key={occ} value={occ}>{occ}</option>
              ))}
            </select>
          </div>

          {/* PDPA Consent */}
          <div className="bg-white bg-opacity-10 rounded-lg p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="pdpaConsent"
                checked={formData.pdpaConsent}
                onChange={handleChange}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-[#157b03] focus:ring-2 focus:ring-[#157b03]"
                required
              />
              <span className="text-white text-sm">
                ฉันยอมรับและเข้าใจเกี่ยวกับนโยบายการคุ้มครองข้อมูลส่วนบุคคล (PDPA) *
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-[#157b03] font-bold py-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-8"
          >
            {loading ? 'กำลังลงทะเบียน...' : 'ลงทะเบียน'}
          </button>

          {/* Already have account */}
          <div className="text-center">
            <span className="text-white text-sm">มีบัญชีอยู่แล้ว? </span>
            <Link href="/profile" className="text-white underline font-medium text-sm hover:text-gray-200">
              เข้าสู่ระบบ
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
