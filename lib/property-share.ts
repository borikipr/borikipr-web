import type { AppLocale } from "@/lib/i18n/locales";

export const PROPERTY_SHARE_CHANNELS = [
  "whatsapp",
  "facebook",
  "copy",
  "qr",
] as const;

export type PropertyShareChannel = (typeof PROPERTY_SHARE_CHANNELS)[number];

export function buildPropertyShareUrl(
  canonicalUrl: string,
  propertySlug: string,
  channel: PropertyShareChannel
) {
  const url = new URL(canonicalUrl);
  url.searchParams.set("utm_source", channel);
  url.searchParams.set("utm_medium", "share");
  url.searchParams.set("utm_campaign", "property_share");
  url.searchParams.set("utm_content", propertySlug);
  return url.toString();
}

export function buildWhatsAppShareUrl(messageTemplate: string, title: string, shareUrl: string) {
  const message = messageTemplate
    .replace("{title}", title)
    .replace("{url}", shareUrl);
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export async function tryCopyPropertyShareUrl(
  writeText: ((value: string) => Promise<void>) | undefined,
  shareUrl: string
) {
  if (!writeText) return false;

  try {
    await writeText(shareUrl);
    return true;
  } catch {
    return false;
  }
}

export function buildPropertyShareEventParams(
  propertySlug: string,
  channel: PropertyShareChannel,
  locale: AppLocale
) {
  return {
    property_slug: propertySlug,
    share_channel: channel,
    locale,
  };
}
