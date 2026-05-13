export type ImageTag = "main" | "interior" | "setup" | "exterior" | "event";

export interface CenterImage {
  url: string;
  tag: ImageTag;
}

export const IMAGE_TAGS: { value: ImageTag; label: string }[] = [
  { value: "main", label: "MAIN" },
  { value: "interior", label: "INTERIOR" },
  { value: "setup", label: "SETUP" },
  { value: "exterior", label: "EXTERIOR" },
  { value: "event", label: "EVENT" },
];

/** Get the main/cover image URL from a categorized images array */
export function getMainImage(images: CenterImage[] | string[] | unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  // Support legacy string[] format
  if (typeof images[0] === "string") return images[0] as string;
  // New format: find main tag first, fallback to first image
  const typed = images as CenterImage[];
  const main = typed.find((img) => img.tag === "main");
  return main?.url ?? typed[0]?.url ?? null;
}

/** Get all image URLs, optionally filtered by tag */
export function getImagesByTag(images: CenterImage[] | string[] | unknown, tag?: ImageTag): string[] {
  if (!Array.isArray(images) || images.length === 0) return [];
  // Legacy format
  if (typeof images[0] === "string") return images as string[];
  const typed = images as CenterImage[];
  if (!tag) return typed.map((img) => img.url);
  return typed.filter((img) => img.tag === tag).map((img) => img.url);
}
