/**
 * บีบอัดรูปภาพให้ขนาดไม่เกิน maxSizeBytes (default 0.5 MB)
 * ใช้ Canvas API วนลด quality จนผ่านเกณฑ์
 */
export async function compressImage(
  file: File,
  maxSizeBytes = 0.5 * 1024 * 1024, // 0.5 MB
  maxDimension = 1280               // ลด resolution ลงจาก 1920 → 1280 เพื่อช่วยให้ไฟล์เล็กลงไวขึ้น
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      // คำนวณ dimension ใหม่ถ้าใหญ่เกิน
      let { width, height } = img
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      // เริ่มที่ quality 0.85 และลดทีละ 0.15 เพื่อให้ถึงเป้าเร็วขึ้น
      let quality = 0.85
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('Canvas toBlob failed')); return }

            if (blob.size <= maxSizeBytes || quality <= 0.1) {
              // แปลงเป็น dataUrl ด้วย
              const reader = new FileReader()
              reader.onload = () => resolve({ blob, dataUrl: reader.result as string })
              reader.onerror = reject
              reader.readAsDataURL(blob)
            } else {
              // ลด quality ทีละ 0.15 (เร็วกว่าเดิมที่ลดทีละ 0.1)
              quality = Math.max(0.1, quality - 0.15)
              tryCompress()
            }
          },
          'image/jpeg',
          quality
        )
      }

      tryCompress()
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }

    img.src = objectUrl
  })
}
