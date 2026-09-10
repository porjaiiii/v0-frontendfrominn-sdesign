export async function compressImage(
  file: File,
  _maxSizeBytes = 300 * 1024,
  _maxDimension = 1024
): Promise<{ blob: Blob; dataUrl: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File is not an image')
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to prepare image preview'))
        return
      }

      resolve({ blob: file, dataUrl: reader.result })
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}