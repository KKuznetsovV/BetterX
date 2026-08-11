const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/svg+xml', 'image/avif', 'image/tiff', 'image/heic',
    'image/bmp', 'image/x-bmp',
    'image/x-canon-cr2', 'image/x-nikon-nef', 'image/x-sony-arw', 'image/x-raw',
    'image/vnd.adobe.photoshop', 'image/x-photoshop', 'image/photoshop',
    'application/pdf', 'application/postscript', 'application/illustrator', 'image/x-eps',
])

const ALLOWED_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg',
    '.avif', '.tif', '.tiff', '.heic', '.bmp',
    '.cr2', '.nef', '.arw',
    '.psd', '.pdf', '.eps', '.ai',
])

export const FORMAT_LABEL = 'JPEG, PNG, WebP, GIF, SVG, AVIF, TIFF, HEIC, BMP, RAW, PSD, PDF, EPS, AI'

export function validateImageFile(file: File): string | null {
    if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
        return `Unsupported format "${file.type || 'unknown'}". Allowed: ${FORMAT_LABEL}`
    }
    return null
}

export function validateImageUrl(url: string): string | null {
    const ext = url.split('?')[0].toLowerCase().match(/(\.[^./\\]+)$/)?.[1]
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
        return `Unsupported image URL. Allowed extensions: ${[...ALLOWED_EXTENSIONS].join(', ')}`
    }
    return null
}
