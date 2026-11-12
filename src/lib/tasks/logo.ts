/** Uploaded logos: read the file, then let the user frame it (zoom + pan) and bake a small square data URL for the projects table. */
export const LOGO_SIZE = 128;
export const LOGO_MAX_UPLOAD = 5 * 1024 * 1024;
const LOGO_MAX_STORED = 200_000; // characters of data URL; matches the database check

/** How the image sits in the square frame. `zoom` 1 = the whole image just fits; x/y move its centre, as a fraction of the frame side. */
export type LogoFrame = { zoom: number; x: number; y: number };

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 10;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not open the image.'));
    i.src = src;
  });
}

/** Checks the file and returns it as a data URL, ready for the editor. */
export async function readLogoFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (PNG, JPG, SVG or WebP).');
  if (file.size > LOGO_MAX_UPLOAD) throw new Error('The image is larger than 5 MB. Choose a smaller one.');
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read the image.'));
    r.readAsDataURL(file);
  });
  await loadImage(src); // fail early if the browser cannot decode it
  return src;
}

/** Natural size, with a fallback for SVGs that declare none. */
export function imageSize(img: HTMLImageElement) {
  return { w: img.naturalWidth || 512, h: img.naturalHeight || 512 };
}

/** Zoom at which the image covers the whole square (no empty edges). */
export function coverZoom(img: HTMLImageElement) {
  const { w, h } = imageSize(img);
  return Math.max(w, h) / Math.min(w, h);
}

/** Paints the framed image onto a square canvas and returns it as a data URL. Empty edges stay transparent. */
export function renderLogo(img: HTMLImageElement, f: LogoFrame): string {
  const { w, h } = imageSize(img);
  const out = LOGO_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image.');
  ctx.imageSmoothingQuality = 'high';
  const scale = (out / Math.max(w, h)) * f.zoom;
  ctx.translate(out / 2 + f.x * out, out / 2 + f.y * out);
  ctx.scale(scale, scale);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  let data = canvas.toDataURL('image/webp', 0.9);
  if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/png');
  if (data.length > LOGO_MAX_STORED) throw new Error('This image is too detailed to store. Try a simpler logo.');
  return data;
}
