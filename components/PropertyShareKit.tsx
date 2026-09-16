"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconBrandFacebook,
  IconBrandWhatsapp,
  IconCheck,
  IconCopy,
  IconQrcode,
  IconX,
} from "@tabler/icons-react";
import { QRCodeSVG } from "qrcode.react";
import { trackAnalyticsEvent } from "@/lib/analytics";
import type { AppLocale } from "@/lib/i18n/locales";
import {
  buildPropertyShareEventParams,
  buildPropertyShareUrl,
  buildWhatsAppShareUrl,
  tryCopyPropertyShareUrl,
  type PropertyShareChannel,
} from "@/lib/property-share";

type PropertyShareCopy = {
  label: string;
  whatsapp: string;
  whatsappAccessible: string;
  whatsappMessage: string;
  facebook: string;
  facebookAccessible: string;
  copyLink: string;
  copyLinkAccessible: string;
  copied: string;
  copyFailed: string;
  manualCopy: string;
  qr: string;
  qrAccessible: string;
  qrTitle: string;
  qrDescription: string;
  qrImageAccessible: string;
  closeDialog: string;
};

function shareButtonClasses() {
  return "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#11518b]/20 bg-white px-3.5 py-2 text-sm font-semibold text-[#11518b] transition hover:border-[#11518b]/45 hover:bg-[#f5f9fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#11518b]";
}

export default function PropertyShareKit({
  canonicalUrl,
  propertySlug,
  propertyTitle,
  locale,
  copy,
}: {
  canonicalUrl: string;
  propertySlug: string;
  propertyTitle: string;
  locale: AppLocale;
  copy: PropertyShareCopy;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [qrOpen, setQrOpen] = useState(false);
  const qrTriggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const manualUrlRef = useRef<HTMLInputElement>(null);

  const whatsappShareUrl = buildPropertyShareUrl(canonicalUrl, propertySlug, "whatsapp");
  const facebookShareUrl = buildPropertyShareUrl(canonicalUrl, propertySlug, "facebook");
  const copyShareUrl = buildPropertyShareUrl(canonicalUrl, propertySlug, "copy");
  const qrShareUrl = buildPropertyShareUrl(canonicalUrl, propertySlug, "qr");
  const whatsappUrl = buildWhatsAppShareUrl(
    copy.whatsappMessage,
    propertyTitle,
    whatsappShareUrl
  );
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(facebookShareUrl)}`;

  const trackShare = (channel: PropertyShareChannel) => {
    trackAnalyticsEvent(
      "property_share",
      buildPropertyShareEventParams(propertySlug, channel, locale)
    );
  };

  const handleCopy = async () => {
    const copied = await tryCopyPropertyShareUrl(
      navigator.clipboard?.writeText.bind(navigator.clipboard),
      copyShareUrl
    );

    if (copied) {
      setCopyState("copied");
      trackShare("copy");
      return;
    }

    setCopyState("manual");
    window.requestAnimationFrame(() => {
      manualUrlRef.current?.focus();
      manualUrlRef.current?.select();
    });
  };

  const openQr = () => {
    setQrOpen(true);
    trackShare("qr");
  };

  const closeQr = () => setQrOpen(false);

  useEffect(() => {
    if (!qrOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeQr();
        return;
      }

      if (event.key !== "Tab") return;

      const controls = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      const first = controls[0];
      const last = controls[controls.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      qrTriggerRef.current?.focus();
    };
  }, [qrOpen]);

  return (
    <div className="mt-4" aria-label={copy.label}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4d4d4d]">
        {copy.label}
      </p>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackShare("whatsapp")}
          aria-label={copy.whatsappAccessible.replace("{property}", propertyTitle)}
          className={shareButtonClasses()}
        >
          <IconBrandWhatsapp aria-hidden="true" className="h-4 w-4" />
          {copy.whatsapp}
        </a>

        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackShare("facebook")}
          aria-label={copy.facebookAccessible.replace("{property}", propertyTitle)}
          className={shareButtonClasses()}
        >
          <IconBrandFacebook aria-hidden="true" className="h-4 w-4" />
          {copy.facebook}
        </a>

        <button
          type="button"
          onClick={handleCopy}
          aria-label={copy.copyLinkAccessible.replace("{property}", propertyTitle)}
          className={shareButtonClasses()}
        >
          {copyState === "copied" ? (
            <IconCheck aria-hidden="true" className="h-4 w-4" />
          ) : (
            <IconCopy aria-hidden="true" className="h-4 w-4" />
          )}
          {copyState === "copied" ? copy.copied : copy.copyLink}
        </button>

        <button
          ref={qrTriggerRef}
          type="button"
          onClick={openQr}
          aria-haspopup="dialog"
          aria-expanded={qrOpen}
          aria-label={copy.qrAccessible.replace("{property}", propertyTitle)}
          className={shareButtonClasses()}
        >
          <IconQrcode aria-hidden="true" className="h-4 w-4" />
          {copy.qr}
        </button>
      </div>

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {copyState === "copied" ? copy.copied : ""}
      </span>

      {copyState === "manual" && (
        <div className="mt-2 space-y-2 text-sm text-[#4d4d4d]" aria-live="polite" aria-atomic="true">
          <p>{copy.copyFailed} {copy.manualCopy}</p>
          <input
            ref={manualUrlRef}
            type="text"
            readOnly
            value={copyShareUrl}
            onFocus={(event) => event.currentTarget.select()}
            aria-label={copy.manualCopy}
            className="w-full rounded-xl border border-[#cccccc] bg-white px-3 py-2 text-sm text-[#111111] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#11518b]"
          />
        </div>
      )}

      {qrOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeQr();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="property-share-qr-title"
            aria-describedby="property-share-qr-description"
            className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8"
          >
            <button
              type="button"
              onClick={closeQr}
              autoFocus
              aria-label={copy.closeDialog}
              className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-[#4d4d4d] transition hover:bg-[#f1f1f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#11518b]"
            >
              <IconX aria-hidden="true" className="h-5 w-5" />
            </button>

            <p className="eyebrow pr-10">{copy.label}</p>
            <h2 id="property-share-qr-title" className="mt-3 text-2xl font-bold text-[#11518b]">
              {copy.qrTitle}
            </h2>
            <p id="property-share-qr-description" className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
              {copy.qrDescription}
            </p>

            <div
              role="img"
              aria-label={copy.qrImageAccessible.replace("{property}", propertyTitle)}
              className="mx-auto mt-6 flex w-fit rounded-2xl border border-[#e8e8e8] bg-white p-4"
            >
              <QRCodeSVG value={qrShareUrl} size={208} level="M" marginSize={0} />
            </div>

            <input
              type="text"
              readOnly
              value={qrShareUrl}
              onFocus={(event) => event.currentTarget.select()}
              aria-label={copy.qrImageAccessible.replace("{property}", propertyTitle)}
              className="mt-5 w-full rounded-xl border border-[#cccccc] bg-[#f8f8f8] px-3 py-2 text-xs text-[#4d4d4d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#11518b]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
