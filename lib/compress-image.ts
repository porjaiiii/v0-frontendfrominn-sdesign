export async function compressImage(
  file: File,
  maxSizeBytes = 300 * 1024,
  maxDimension = 1024
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    // 1. เช็คว่าเป็นไฟล์รูปภาพแน่ๆ (กันไฟล์แปลกๆ หรือ HEIC ในบางกรณี)
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File is not an image'));
    }

    const img = new window.Image();
    
    // 2. ใช้ URL.createObjectURL แทน FileReader (ประหยัด RAM มหาศาล)
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      // คืน Memory ทันทีที่โหลดรูปเสร็จ
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        return reject(new Error('Canvas setup failed'));
      }
      
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('Canvas toBlob failed')); return; }

            if (blob.size <= maxSizeBytes || quality <= 0.1) {
              // อ่านเฉพาะไฟล์ที่ย่อเสร็จแล้วเป็น Base64 เพื่อส่งออก
              const reader = new FileReader();
              reader.onload = () => resolve({ blob, dataUrl: reader.result as string });
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            } else {
              quality = Math.max(0.1, quality - 0.15);
              tryCompress();
            }
          },
          'image/jpeg',
          quality
        );
      };

      tryCompress();
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image. If this is an HEIC file from iPhone, it might not be supported.'));
    };

    img.src = objectUrl;
  });
}