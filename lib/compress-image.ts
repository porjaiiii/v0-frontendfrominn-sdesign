/**
 * บีบอัดรูปภาพให้ขนาดไม่เกิน maxSizeBytes (default 2 MB)
 * ใช้ Canvas API วนลด quality จนผ่านเกณฑ์
 *
 * The 0.5 MB / 1280px target this replaces was not a quality decision. Images
 * went to the server as base64 through a Vercel function, base64 inflates by
 * ~33%, and the body limit is 4.5MB — so the ceiling had to be low, and evidence
 * photos came out too soft to read a label on.
 *
 * Phase 6 PUTs the Blob straight to storage (lib/api-client.ts), so neither
 * limit applies any more.
 */
export async function compressImage(
  file: File,
  maxSizeBytes = 2 * 1024 * 1024,   // 2 MB
  maxDimension = 1920
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader()

    fileReader.onload = () => {
      const img = new window.Image()

      img.onload = () => {
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
        reject(new Error('Failed to load image'))
      }

      img.src = fileReader.result as string
    }

    fileReader.onerror = () => reject(new Error('Failed to read image file'))
    fileReader.readAsDataURL(file)
  })
}
