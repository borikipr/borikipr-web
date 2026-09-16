export const BROCHURE_IMAGE_LIMITS = Object.freeze({
  maxCandidates: 12,
  maxImages: 6,
  maxImageBytes: 8 * 1024 * 1024,
  maxTotalBytes: 24 * 1024 * 1024,
  timeoutMs: 5_000,
  maxRedirects: 2,
});

export type BrochureImageAsset = {
  bytes: Uint8Array;
  format: "jpeg" | "png";
  sourceUrl: string;
};

const VIDEO_OR_WEBP = /\.(?:webp|mp4|webm|mov)(?:$|[?#])/i;

export function isApprovedPropertyImageUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "img.borikipr.com" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname.startsWith("/propiedades/")
    );
  } catch {
    return false;
  }
}

export function detectSupportedImageFormat(bytes: Uint8Array): BrochureImageAsset["format"] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  return null;
}

async function readBoundedBody(response: Response, limit: number) {
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > limit) return null;
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function fetchApprovedImage(
  initialUrl: string,
  fetchImpl: typeof fetch,
  remainingBytes: number,
) {
  let currentUrl = initialUrl;
  for (let redirectCount = 0; redirectCount <= BROCHURE_IMAGE_LIMITS.maxRedirects; redirectCount += 1) {
    if (!isApprovedPropertyImageUrl(currentUrl)) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BROCHURE_IMAGE_LIMITS.timeoutMs);
    try {
      const response = await fetchImpl(currentUrl, {
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "image/jpeg,image/png" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirectCount === BROCHURE_IMAGE_LIMITS.maxRedirects) return null;
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      if (!response.ok) return null;

      const limit = Math.min(BROCHURE_IMAGE_LIMITS.maxImageBytes, remainingBytes);
      if (limit <= 0) return null;
      const bytes = await readBoundedBody(response, limit);
      if (!bytes) return null;
      const format = detectSupportedImageFormat(bytes);
      if (!format) return null;
      return { bytes, format, sourceUrl: currentUrl } satisfies BrochureImageAsset;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

export async function fetchPropertyBrochureImages(
  orderedUrls: string[],
  fetchImpl: typeof fetch = fetch,
) {
  const assets: BrochureImageAsset[] = [];
  let fetchedBytes = 0;

  for (const sourceUrl of orderedUrls.slice(0, BROCHURE_IMAGE_LIMITS.maxCandidates)) {
    if (assets.length >= BROCHURE_IMAGE_LIMITS.maxImages) break;
    if (VIDEO_OR_WEBP.test(sourceUrl) || !isApprovedPropertyImageUrl(sourceUrl)) continue;
    const asset = await fetchApprovedImage(
      sourceUrl,
      fetchImpl,
      BROCHURE_IMAGE_LIMITS.maxTotalBytes - fetchedBytes,
    );
    if (!asset) continue;
    fetchedBytes += asset.bytes.byteLength;
    assets.push(asset);
  }

  return assets;
}
