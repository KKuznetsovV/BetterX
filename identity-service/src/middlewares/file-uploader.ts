
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

const FORMAT_LABEL = 'JPEG, PNG, WebP, GIF, SVG, AVIF, TIFF, HEIC, BMP, RAW (.cr2/.nef/.arw), PSD, PDF, EPS, AI'

export function validateImageSource(url: string): void {
    if (url.startsWith('data:')) {
        const mime = url.match(/^data:([^;]+);/)?.[1]?.toLowerCase()
        if (!mime || !ALLOWED_MIME_TYPES.has(mime)) {
            throw { status: 422, message: `Unsupported image format. Allowed: ${FORMAT_LABEL}` }
        }
    } else {
        const ext = url.split('?')[0].toLowerCase().match(/(\.[^./\\]+)$/)?.[1]
        if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
            throw { status: 422, message: `Unsupported image URL. Allowed extensions: ${[...ALLOWED_EXTENSIONS].join(', ')}` }
        }
    }
}
