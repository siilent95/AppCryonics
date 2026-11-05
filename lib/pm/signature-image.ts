import sharp from "sharp";
import { RequestValidationError } from "@/app/api/pm-records/_shared";
const MAX_SIGNATURE_BYTES = 384_000;
export async function parseSignatureDataUrl(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new RequestValidationError(`${label} signature is required.`);
  }
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new RequestValidationError(`${label} signature must be a PNG image.`);

  if (match[1].length > Math.ceil(MAX_SIGNATURE_BYTES / 3) * 4) throw new RequestValidationError(`${label} signature image size is invalid.`);
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(match[1]), character => character.charCodeAt(0)); }
  catch { throw new RequestValidationError(`${label} signature must use valid PNG encoding.`); }
  if (bytes.byteLength < 100 || bytes.byteLength > MAX_SIGNATURE_BYTES) {
    throw new RequestValidationError(`${label} signature image size is invalid.`);
  }
  const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!pngHeader.every((byte, index) => bytes[index] === byte)) {
    throw new RequestValidationError(`${label} signature image is invalid.`);
  }
  try {
    const image = sharp(bytes, { limitInputPixels: 2_000_000, animated: false, failOn: "warning" });
    const metadata = await image.metadata();
    if (metadata.format !== "png" || (metadata.pages || 1) !== 1) throw new Error();
    await image.raw().toBuffer();
  } catch { throw new RequestValidationError(`${label} signature must be a valid PNG image (maximum 2 megapixels).`); }
  return bytes;
}
