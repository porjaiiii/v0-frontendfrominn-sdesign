/**
 * บีบอัดรูปภาพให้ขนาดไม่เกิน maxSizeBytes (default 0.8 MB)
 * ใช้ Canvas API วนลด quality จนผ่านเกณฑ์
 */
export async function compressImage(
  file: File,
  maxSizeBytes = 0.8 * 1024 * 1024, // 0.8 MB
  maxDimension = 1920
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

      // ลด quality ลงเรื่อยๆ จนขนาดผ่านเกณฑ์
      let quality = 0.9
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
              quality = Math.max(0.1, quality - 0.1)
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
