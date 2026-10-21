import { ALLOWED_IMAGE_TYPES, type NewReceipt } from '../db/repo';

export const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 2200;
const COMPRESS_ABOVE_BYTES = 900 * 1024;

export class ImageError extends Error {}

/**
 * يتحقق من الصورة ويضغطها عند الحاجة مع الحفاظ على وضوح الإيصال:
 * أقصى بُعد 2200 بكسل وجودة 0.86، ولا نستبدل الأصل إن لم يصغر الحجم فعلًا.
 */
export async function prepareReceipt(file: File): Promise<NewReceipt> {
  const mime = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  if (!ALLOWED_IMAGE_TYPES.includes(mime)) throw new ImageError('الصيغ المدعومة: JPG أو PNG أو WebP');
  if (file.size > MAX_ORIGINAL_BYTES) throw new ImageError('حجم الصورة أكبر من 5 ميغابايت');

  const original: NewReceipt = { filename: file.name || 'receipt', mimeType: mime, data: await file.arrayBuffer() };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= COMPRESS_ABOVE_BYTES) { bitmap.close(); return original; }

    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.fillStyle = '#fff'; // خلفية بيضاء للصور الشفافة عند التحويل
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    let blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.86));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
    if (!blob || blob.size >= file.size) return original;
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return { filename: original.filename.replace(/\.[^.]+$/, '') + '.' + ext, mimeType: blob.type, data: await blob.arrayBuffer() };
  } catch {
    // إن فشل الضغط (متصفح قديم) نحفظ الأصل كما هو
    return original;
  }
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} بايت`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} ك.ب`;
  return `${(n / 1024 / 1024).toFixed(1)} م.ب`;
}
