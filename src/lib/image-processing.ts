import sharp from "sharp";

export type ProcessedMarketplaceImage = {
  original: Buffer;
  card: Buffer;
  main: Buffer;
  detail: Buffer;
  width: number | null;
  height: number | null;
};

const MAX_INPUT_PIXELS = 120_000_000;
const MIN_WEBP_BYTES = 64;

export type ImageVariantVerification = {
  name: string;
  byteLength: number;
  contentType: "image/webp";
  width: number | null;
  height: number | null;
};

export async function verifyWebpBuffer(
  name: string,
  buffer: Buffer,
): Promise<ImageVariantVerification> {
  if (buffer.byteLength < MIN_WEBP_BYTES) {
    throw new Error(`${name} image is suspiciously small.`);
  }

  if (
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    throw new Error(`${name} image is not a valid WebP RIFF payload.`);
  }

  const metadata = await sharp(buffer, {
    limitInputPixels: MAX_INPUT_PIXELS,
  }).metadata();

  if (metadata.format !== "webp") {
    throw new Error(`${name} image could not be decoded as WebP.`);
  }

  return {
    name,
    byteLength: buffer.byteLength,
    contentType: "image/webp",
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  };
}

export async function verifyProcessedMarketplaceImage(
  processed: ProcessedMarketplaceImage,
) {
  return Promise.all([
    verifyWebpBuffer("original", processed.original),
    verifyWebpBuffer("card", processed.card),
    verifyWebpBuffer("main", processed.main),
    verifyWebpBuffer("detail", processed.detail),
  ]);
}

export async function processMarketplaceImage(
  input: Buffer,
): Promise<ProcessedMarketplaceImage> {
  const normalized = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).rotate();
  const metadata = await normalized.metadata();

  const [original, card, main, detail] = await Promise.all([
    normalized.clone().webp({ quality: 95 }).toBuffer(),
    normalized
      .clone()
      .resize(320, 320, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer(),
    normalized
      .clone()
      .resize(960, 960, { fit: "cover", position: "attention" })
      .webp({ quality: 88 })
      .toBuffer(),
    normalized
      .clone()
      .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 92 })
      .toBuffer(),
  ]);

  const processed = {
    original,
    card,
    main,
    detail,
    width: metadata.autoOrient?.width ?? metadata.width ?? null,
    height: metadata.autoOrient?.height ?? metadata.height ?? null,
  };

  await verifyProcessedMarketplaceImage(processed);

  return processed;
}
