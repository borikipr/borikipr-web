import type { NormalizedRect } from "./types";
import type { RenderedPdfPage } from "./render";

export type VisualRegressionResult = Readonly<{
  changedPixelsInsideExpectedRegions: number;
  changedPixelsOutsideExpectedRegions: number;
  outsideChangeRatio: number;
}>;

function isInsideExpectedRegion(
  x: number,
  y: number,
  width: number,
  height: number,
  regions: readonly NormalizedRect[],
  paddingPixels: number
) {
  return regions.some((region) => {
    const left = region.x * width - paddingPixels;
    const top = region.y * height - paddingPixels;
    const right = (region.x + region.width) * width + paddingPixels;
    const bottom = (region.y + region.height) * height + paddingPixels;
    return x >= left && x <= right && y >= top && y <= bottom;
  });
}
export function compareRenderedPdfPages({
  source,
  finalized,
  expectedRegions,
  channelTolerance = 24,
  paddingPixels = 6,
}: {
  source: RenderedPdfPage;
  finalized: RenderedPdfPage;
  expectedRegions: readonly NormalizedRect[];
  channelTolerance?: number;
  paddingPixels?: number;
}): VisualRegressionResult {
  if (source.width !== finalized.width || source.height !== finalized.height) {
    throw new Error("Rendered page dimensions changed during finalization.");
  }
  let inside = 0;
  let outside = 0;
  let outsidePixels = 0;
  for (let pixel = 0; pixel < source.width * source.height; pixel += 1) {
    const x = pixel % source.width;
    const y = Math.floor(pixel / source.width);
    const isInside = isInsideExpectedRegion(
      x,
      y,
      source.width,
      source.height,
      expectedRegions,
      paddingPixels
    );
    if (!isInside) outsidePixels += 1;
    const offset = pixel * 4;
    const changed =
      Math.abs(source.rgba[offset] - finalized.rgba[offset]) > channelTolerance ||
      Math.abs(source.rgba[offset + 1] - finalized.rgba[offset + 1]) > channelTolerance ||
      Math.abs(source.rgba[offset + 2] - finalized.rgba[offset + 2]) > channelTolerance ||
      Math.abs(source.rgba[offset + 3] - finalized.rgba[offset + 3]) > channelTolerance;
    if (!changed) continue;
    if (isInside) inside += 1;
    else outside += 1;
  }
  return {
    changedPixelsInsideExpectedRegions: inside,
    changedPixelsOutsideExpectedRegions: outside,
    outsideChangeRatio: outsidePixels === 0 ? 0 : outside / outsidePixels,
  };
}
