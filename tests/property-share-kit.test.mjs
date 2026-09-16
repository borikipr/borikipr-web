import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildPropertyShareUrl,
  buildPropertyShareEventParams,
  buildWhatsAppShareUrl,
  PROPERTY_SHARE_CHANNELS,
  tryCopyPropertyShareUrl,
} from "../lib/property-share.ts";

const shareKit = await readFile(
  new URL("../components/PropertyShareKit.tsx", import.meta.url),
  "utf8"
);
const detail = await readFile(
  new URL("../app/(public)/listados/[slug]/page.tsx", import.meta.url),
  "utf8"
);
const seo = await readFile(
  new URL("../lib/i18n/seo.ts", import.meta.url),
  "utf8"
);
const trackingRoute = await readFile(
  new URL("../app/api/track/route.ts", import.meta.url),
  "utf8"
);

test("share URLs preserve locale paths and add the approved non-PII UTM model", () => {
  assert.deepEqual(PROPERTY_SHARE_CHANNELS, ["whatsapp", "facebook", "copy", "qr"]);

  for (const channel of PROPERTY_SHARE_CHANNELS) {
    const url = new URL(
      buildPropertyShareUrl(
        "https://borikipr.com/en/listings/casa-cotolaurel-ponce",
        "casa-cotolaurel-ponce",
        channel
      )
    );
    assert.equal(url.pathname, "/en/listings/casa-cotolaurel-ponce");
    assert.equal(url.searchParams.get("utm_source"), channel);
    assert.equal(url.searchParams.get("utm_medium"), "share");
    assert.equal(url.searchParams.get("utm_campaign"), "property_share");
    assert.equal(url.searchParams.get("utm_content"), "casa-cotolaurel-ponce");
    assert.equal(url.searchParams.has("email"), false);
    assert.equal(url.searchParams.has("phone"), false);
    assert.equal(url.searchParams.has("client_id"), false);
  }
});

test("WhatsApp sharing uses the generic chooser and a localized prepared message", () => {
  const shareUrl = buildPropertyShareUrl(
    "https://borikipr.com/listados/hacienda-monte-carmelo",
    "hacienda-monte-carmelo",
    "whatsapp"
  );
  const url = new URL(
    buildWhatsAppShareUrl(
      "Mira esta propiedad en Borikí: {title} — {url}",
      "Hacienda Monte Carmelo",
      shareUrl
    )
  );
  assert.equal(url.hostname, "wa.me");
  assert.equal(url.pathname, "/");
  assert.match(url.searchParams.get("text") ?? "", /Hacienda Monte Carmelo/);
  assert.match(url.searchParams.get("text") ?? "", /utm_source=whatsapp/);
});

test("Facebook, copy, and QR actions use safe browser behavior and approved analytics", () => {
  assert.match(shareKit, /facebook\.com\/sharer\/sharer\.php\?u=/);
  assert.match(shareKit, /target="_blank"/);
  assert.match(shareKit, /rel="noopener noreferrer"/);
  assert.doesNotMatch(shareKit, /facebook\.com\/sdk|connect\.facebook\.net|FB\.init/);
  assert.match(shareKit, /navigator\.clipboard\?\.writeText\.bind\(navigator\.clipboard\)/);
  assert.match(shareKit, /trackAnalyticsEvent\(\s*"property_share"/);
  assert.match(shareKit, /<QRCodeSVG value=\{qrShareUrl\}/);

  assert.deepEqual(
    buildPropertyShareEventParams("casa-cotolaurel-ponce", "facebook", "es-PR"),
    {
      property_slug: "casa-cotolaurel-ponce",
      share_channel: "facebook",
      locale: "es-PR",
    }
  );
});

test("copy success and failure are detected without fallback analytics noise", async () => {
  const copiedValues = [];
  assert.equal(
    await tryCopyPropertyShareUrl(async (value) => copiedValues.push(value), "https://example.com/share"),
    true
  );
  assert.deepEqual(copiedValues, ["https://example.com/share"]);
  assert.equal(
    await tryCopyPropertyShareUrl(async () => { throw new Error("denied"); }, "https://example.com/share"),
    false
  );
  assert.equal(await tryCopyPropertyShareUrl(undefined, "https://example.com/share"), false);

  const copySuccessBlock = shareKit.slice(
    shareKit.indexOf("const handleCopy = async"),
    shareKit.indexOf("const openQr")
  );
  assert.match(copySuccessBlock, /setCopyState\("copied"\)/);
  assert.match(copySuccessBlock, /trackShare\("copy"\)/);
  assert.match(copySuccessBlock, /setCopyState\("manual"\)/);
  assert.doesNotMatch(copySuccessBlock.split('setCopyState("manual")')[1], /trackShare\("copy"\)/);
  assert.match(shareKit, /ref=\{manualUrlRef\}/);
  assert.match(shareKit, /readOnly/);
  assert.match(shareKit, /aria-live="polite"/);
  assert.doesNotMatch(shareKit, /execCommand/);
});

test("QR dialog is labelled, keyboard-contained, and returns focus", () => {
  assert.match(shareKit, /role="dialog"/);
  assert.match(shareKit, /aria-modal="true"/);
  assert.match(shareKit, /aria-labelledby="property-share-qr-title"/);
  assert.match(shareKit, /aria-describedby="property-share-qr-description"/);
  assert.match(shareKit, /event\.key === "Escape"/);
  assert.match(shareKit, /event\.key !== "Tab"/);
  assert.match(shareKit, /qrTriggerRef\.current\?\.focus\(\)/);
  assert.match(shareKit, /autoFocus/);
  assert.doesNotMatch(shareKit, /accordion/i);
});

test("canonical metadata remains query-free and share events never enter DB tracking", () => {
  assert.match(detail, /canonicalUrl=\{propiedadUrl\}/);
  assert.doesNotMatch(detail, /searchParams/);
  assert.match(seo, /alternates: \{ canonical: urls\.canonical/);
  assert.match(seo, /url: urls\.canonical/);
  assert.doesNotMatch(trackingRoute, /property_share/);
  assert.doesNotMatch(shareKit, /\/api\/track|lead_events|fetch\(/);
});

test("share controls retain practical touch targets and responsive wrapping", () => {
  assert.match(shareKit, /min-h-11/);
  assert.match(shareKit, /grid grid-cols-2 gap-2/);
});
