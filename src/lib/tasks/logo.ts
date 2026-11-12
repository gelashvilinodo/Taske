/** Turns an uploaded image into a small centre-cropped square data URL so it can live in the projects table. */
export const LOGO_SIZE = 128;
export const LOGO_MAX_UPLOAD = 5 * 1024 * 1024;
const LOGO_MAX_STORED = 200_000; // characters of data URL; matches the database check

export async function prepareLogo(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (PNG, JPG, SVG or WebP).');
  if (file.size > LOGO_MAX_UPLOAD) throw new Error('The image is larger than 5 MB. Choose a smaller one.');
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read the image.'));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not open the image.'));
    i.src = src;
  });
  // Centre-crop to a square so the photo fills the whole logo tile.
  const w = img.naturalWidth || LOGO_SIZE, h = img.naturalHeight || LOGO_SIZE;
  const side = Math.min(w, h);
  const outSide = Math.max(1, Math.min(LOGO_SIZE, Math.round(side)));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = outSide;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, outSide, outSide);
  let out = canvas.toDataURL('image/webp', 0.9);
  if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/png');
  if (out.length > LOGO_MAX_STORED) throw new Error('This image is too detailed to store. Try a simpler logo.');
  return out;
}
