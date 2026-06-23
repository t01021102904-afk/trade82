import sharp from "sharp";

export type ProcessedMarketplaceImage = {
  original: Buffer;
  card: Buffer;
  main: Buffer;
  detail: Buffer;
  width: number | null;
  height: number | null;
};

export async function processMarketplaceImage(
  input: Buffer,
): Promise<ProcessedMarketplaceImage> {
  const normalized = sharp(input).rotate();
  const metadata = await normalized.metadata();

  const [original, card, main, detail] = await Promise.all([
    normalized.clone().webp({ quality: 92 }).toBuffer(),
    normalized
      .clone()
      .resize(320, 320, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer(),
    normalized
      .clone()
      .resize(640, 640, { fit: "cover", position: "attention" })
      .webp({ quality: 86 })
      .toBuffer(),
    normalized
      .clone()
      .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer(),
  ]);

  return {
    original,
    card,
    main,
    detail,
    width: metadata.autoOrient?.width ?? metadata.width ?? null,
    height: metadata.autoOrient?.height ?? metadata.height ?? null,
  };
}
