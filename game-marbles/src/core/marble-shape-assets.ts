const marbleShapeIconModules = (import.meta as any).glob("../assets/marble-shapes/icons/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export const marbleShapeIconSources = Object.fromEntries(
  Object.entries(marbleShapeIconModules).map(([path, src]) => {
    const filename = path.split("/").pop() || "";
    return [filename.replace(/\.png$/, ""), src];
  }),
) as Record<string, string>;

export function marbleShapeIconUrl(shape: string) {
  return marbleShapeIconSources[shape] || "";
}

const marbleShapeIconImageCache = new Map<string, HTMLImageElement | null>();

export function marbleShapeIconImage(shape: string) {
  const src = marbleShapeIconUrl(shape);
  if (!src || typeof Image === "undefined") return null;
  if (marbleShapeIconImageCache.has(shape)) return marbleShapeIconImageCache.get(shape) || null;
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  marbleShapeIconImageCache.set(shape, image);
  return image;
}
