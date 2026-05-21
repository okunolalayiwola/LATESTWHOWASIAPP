// src/lib/storage.js
// Cloudinary image upload helper — works directly from the browser.
//
// SETUP (one-time):
//   1. Create a free Cloudinary account at cloudinary.com
//   2. In your Cloudinary dashboard: Settings → Upload → Upload presets
//   3. Create an unsigned upload preset, note the preset name
//   4. Add to your .env file:
//        VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
//        VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
//
// Then just call: const url = await uploadImage(file)

const CLOUD_NAME     = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET  = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const UPLOAD_URL     = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`

/**
 * Upload a File to Cloudinary.
 * @param {File}     file         - The file to upload
 * @param {Function} onProgress   - Called with 0–100 during upload
 * @param {string}   folder       - Optional Cloudinary folder (e.g. 'memorials')
 * @returns {Promise<string>}       Public URL of the uploaded image
 */
export async function uploadImage(file, onProgress, folder = 'whowasi') {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Missing VITE_CLOUDINARY_CLOUD_NAME or VITE_CLOUDINARY_UPLOAD_PRESET in .env'
    )
  }

  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file',           file)
    formData.append('upload_preset',  UPLOAD_PRESET)
    formData.append('folder',         folder)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText)
        // Return an auto-optimised, WebP URL with max 800px width
        const optimised = data.secure_url.replace(
          '/upload/',
          '/upload/f_auto,q_auto,w_800/'
        )
        resolve(optimised)
      } else {
        // Pull Cloudinary's real error message out of the response body
        let detail = ''
        try { detail = JSON.parse(xhr.responseText)?.error?.message || '' } catch {}
        reject(new Error(detail
          ? `Cloudinary ${xhr.status}: ${detail}`
          : `Upload failed (status ${xhr.status})`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error — check your connection')))
    xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')))
    xhr.open('POST', UPLOAD_URL)
    xhr.send(formData)
  })
}

/**
 * Generate a Cloudinary thumbnail URL from any Cloudinary image URL.
 * @param {string} url   - Original Cloudinary URL
 * @param {number} size  - Thumbnail size in px (default 200)
 */
export function thumbnailUrl(url, size = 200) {
  if (!url || !url.includes('cloudinary.com')) return url
  return url.replace('/upload/', `/upload/c_fill,w_${size},h_${size},f_auto,q_auto/`)
}

/**
 * Upload an audio file to Cloudinary.
 * @param {File}     file         - The audio file to upload
 * @param {Function} onProgress   - Called with 0–100 during upload
 * @param {string}   folder       - Optional Cloudinary folder
 * @returns {Promise<{url: string, duration: number}>}
 */
export async function uploadAudio(file, onProgress, folder = 'whowasi') {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Missing VITE_CLOUDINARY_CLOUD_NAME or VITE_CLOUDINARY_UPLOAD_PRESET in .env')
  }

  // Get audio duration before uploading
  const duration = await getAudioDuration(file)

  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file',           file)
    formData.append('upload_preset',  UPLOAD_PRESET)
    formData.append('folder',         folder)
    formData.append('resource_type',  'video') // Cloudinary uses 'video' for audio

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText)
        resolve({ url: data.secure_url, duration })
      } else {
        let detail = ''
        try { detail = JSON.parse(xhr.responseText)?.error?.message || '' } catch {}
        reject(new Error(detail
          ? `Cloudinary ${xhr.status}: ${detail}`
          : `Upload failed (status ${xhr.status})`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error — check your connection')))
    xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')))
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`)
    xhr.send(formData)
  })
}

/**
 * Upload ANY document type to Cloudinary (PDF, Word, images, etc.)
 * Uses the /auto/upload endpoint so Cloudinary detects the type itself.
 * @returns {Promise<{url, fileName, fileType, fileSize, ext}>}
 */
export async function uploadDocument(file, onProgress, folder = 'whowasi/documents') {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Missing VITE_CLOUDINARY_CLOUD_NAME or VITE_CLOUDINARY_UPLOAD_PRESET in .env')
  }

  const ext = (file.name.split('.').pop() || '').toLowerCase()

  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file',          file)
    formData.append('upload_preset', UPLOAD_PRESET)
    formData.append('folder',        folder)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    })

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText)
        resolve({
          url:      data.secure_url,
          fileName: file.name,
          fileType: file.type || `application/${ext}`,
          fileSize: file.size,
          ext,
        })
      } else {
        let detail = ''
        try { detail = JSON.parse(xhr.responseText)?.error?.message || '' } catch {}
        reject(new Error(detail
          ? `Cloudinary ${xhr.status}: ${detail}`
          : `Upload failed (status ${xhr.status}) — check the Cloudinary preset allows raw/auto files`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error — check your connection')))
    xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')))
    // /auto/ endpoint accepts image, video, AND raw (pdf, doc, docx, etc.)
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`)
    xhr.send(formData)
  })
}

/**
 * Build a preview URL for a document.
 * PDFs → Cloudinary renders page 1 as a JPG. Images → thumbnail. Else → null.
 */
export function documentPreviewUrl(url, ext) {
  if (!url) return null
  const e = (ext || url.split('.').pop() || '').toLowerCase()
  if (['jpg','jpeg','png','webp','gif'].includes(e)) {
    return url.includes('cloudinary.com')
      ? url.replace('/upload/', '/upload/c_fill,w_600,f_auto,q_auto/')
      : url
  }
  if (e === 'pdf' && url.includes('cloudinary.com')) {
    // Cloudinary renders the first page of a PDF as an image with pg_1 + .jpg
    return url.replace('/upload/', '/upload/pg_1,w_600,f_jpg,q_auto/').replace(/\.pdf$/i, '.jpg')
  }
  return null  // word docs etc. — no inline image preview, use icon + open
}

/**
 * Get the duration of an audio file in seconds.
 */
function getAudioDuration(file) {
  return new Promise((resolve) => {
    const audio = new Audio()
    const url = URL.createObjectURL(file)
    audio.src = url
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url)
      resolve(Math.round(audio.duration))
    })
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      resolve(0)
    })
  })
}
