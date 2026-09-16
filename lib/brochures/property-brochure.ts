import {
  PDFDocument,
  StandardFonts,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFImage,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { PropertyBrochureData } from "./property-brochure-data";
import type { BrochureImageAsset } from "./property-brochure-images";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const NAVY = rgb(17 / 255, 81 / 255, 139 / 255);
const GOLD = rgb(212 / 255, 175 / 255, 55 / 255);
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(77 / 255, 77 / 255, 77 / 255);
const LIGHT_GRAY = rgb(245 / 255, 247 / 255, 249 / 255);
const BORDER = rgb(232 / 255, 232 / 255, 232 / 255);
const WHITE = rgb(1, 1, 1);

type EmbeddedImage = { image: PDFImage; source: BrochureImageAsset };

export type BuildPropertyBrochureInput = {
  property: PropertyBrochureData;
  images: BrochureImageAsset[];
  qrPng: Uint8Array;
  logoPng?: Uint8Array | null;
};

export function normalizePdfText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF]/g, "?");
}

export function wrapPdfText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const normalized = normalizePdfText(text).replace(/\t/g, " ").trim();
  if (!normalized) return [];
  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  const flushLongWord = (word: string) => {
    let chunk = "";
    for (const character of word) {
      const candidate = `${chunk}${character}`;
      if (chunk && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(chunk);
        chunk = character;
      } else {
        chunk = candidate;
      }
    }
    return chunk;
  };

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = font.widthOfTextAtSize(word, size) <= maxWidth ? word : flushLongWord(word);
  }
  if (line) lines.push(line);
  return lines;
}

function drawLines(
  page: PDFPage,
  lines: string[],
  input: { x: number; y: number; font: PDFFont; size: number; color?: ReturnType<typeof rgb>; lineHeight: number },
) {
  let y = input.y;
  for (const line of lines) {
    page.drawText(line, {
      x: input.x,
      y,
      size: input.size,
      font: input.font,
      color: input.color ?? BLACK,
    });
    y -= input.lineHeight;
  }
  return y;
}

function drawImageCover(page: PDFPage, image: PDFImage, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  page.pushOperators(pushGraphicsState(), rectangle(x, y, width, height), clip(), endPath());
  page.drawImage(image, {
    x: x - (drawWidth - width) / 2,
    y: y - (drawHeight - height) / 2,
    width: drawWidth,
    height: drawHeight,
  });
  page.pushOperators(popGraphicsState());
}

function transactionLabel(value: PropertyBrochureData["transactionType"]) {
  return value === "renta" ? "ALQUILER" : "VENTA";
}

function statusLabel(value: PropertyBrochureData["status"]) {
  return {
    disponible: "Disponible",
    coming_soon: "Próximamente",
    bajo_contrato: "Bajo contrato",
    vendida: "Vendida",
    rentada: "Alquilada",
  }[value];
}

export function formatBrochurePrice(price: number, transactionType: PropertyBrochureData["transactionType"]) {
  if (!Number.isFinite(price) || price <= 0) return "Precio próximamente";
  const amount = `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return transactionType === "renta" ? `${amount}/mes` : amount;
}

export function propertyBrochureMetrics(property: PropertyBrochureData) {
  const metrics: Array<{ label: string; value: string }> = [
    { label: "Tipo", value: property.propertyType },
  ];
  if (property.propertyType !== "Terreno") {
    if (property.bedrooms > 0) metrics.push({ label: "Habitaciones", value: String(property.bedrooms) });
    if (property.bathrooms > 0) metrics.push({ label: "Baños", value: String(property.bathrooms) });
    if (property.parking > 0) metrics.push({ label: "Estacionamientos", value: String(property.parking) });
  }
  if (property.squareMeters > 0) {
    metrics.push({ label: "Área", value: `${property.squareMeters.toLocaleString("en-US")} m²` });
  }
  return metrics;
}

function drawBadge(page: PDFPage, text: string, x: number, y: number, font: PDFFont, inverted = false) {
  const label = normalizePdfText(text);
  const width = font.widthOfTextAtSize(label, 9) + 22;
  page.drawRectangle({ x, y, width, height: 24, color: inverted ? WHITE : NAVY, borderColor: inverted ? BORDER : NAVY, borderWidth: 1 });
  page.drawText(label, { x: x + 11, y: y + 7.5, size: 9, font, color: inverted ? NAVY : WHITE });
  return width;
}

function drawBrandedPlaceholder(page: PDFPage, x: number, y: number, width: number, height: number, bold: PDFFont) {
  page.drawRectangle({ x, y, width, height, color: NAVY });
  page.drawRectangle({ x: x + 16, y: y + 16, width: width - 32, height: height - 32, borderColor: GOLD, borderWidth: 1 });
  const title = "ERICKSON REAL ESTATE";
  const titleWidth = bold.widthOfTextAtSize(title, 17);
  page.drawText(title, { x: x + (width - titleWidth) / 2, y: y + height / 2 + 10, size: 17, font: bold, color: WHITE });
  const caption = "Fotografía próximamente";
  const captionWidth = bold.widthOfTextAtSize(caption, 11);
  page.drawText(caption, { x: x + (width - captionWidth) / 2, y: y + height / 2 - 18, size: 11, font: bold, color: GOLD });
}

function drawPageHeader(page: PDFPage, title: string, bold: PDFFont) {
  page.drawText("ERICKSON REAL ESTATE", { x: MARGIN, y: PAGE_HEIGHT - 47, size: 10, font: bold, color: NAVY });
  page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 58, width: 42, height: 2, color: GOLD });
  page.drawText(normalizePdfText(title), { x: MARGIN, y: PAGE_HEIGHT - 88, size: 22, font: bold, color: NAVY });
}

function formatPhone(value: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value ?? null;
}

function drawContactBlock(
  page: PDFPage,
  input: { y: number; property: PropertyBrochureData; qrImage: PDFImage; regular: PDFFont; bold: PDFFont },
) {
  const { y, property, qrImage, regular, bold } = input;
  page.drawRectangle({ x: MARGIN, y, width: CONTENT_WIDTH, height: 138, color: LIGHT_GRAY, borderColor: BORDER, borderWidth: 1 });
  page.drawRectangle({ x: MARGIN, y: y + 136, width: CONTENT_WIDTH, height: 2, color: GOLD });
  page.drawImage(qrImage, { x: PAGE_WIDTH - MARGIN - 104, y: y + 17, width: 104, height: 104 });
  page.drawText("INFORMACIÓN Y CONTACTO", { x: MARGIN + 18, y: y + 108, size: 9, font: bold, color: GOLD });

  if (property.professional) {
    const role = property.professional.roleId === "real_estate_broker"
      ? "Corredor(a) de Bienes Raíces"
      : "Vendedor(a) de Bienes Raíces";
    page.drawText(normalizePdfText(property.professional.displayName), { x: MARGIN + 18, y: y + 83, size: 16, font: bold, color: NAVY });
    page.drawText(`${role} · Lic. ${normalizePdfText(property.professional.licenseNumber)}`, { x: MARGIN + 18, y: y + 62, size: 10, font: regular, color: GRAY });
    const phone = formatPhone(property.professional.whatsappPhoneE164);
    if (phone) page.drawText(`WhatsApp: ${normalizePdfText(phone)}`, { x: MARGIN + 18, y: y + 43, size: 10, font: bold, color: NAVY });
  } else {
    page.drawText("Erickson Real Estate", { x: MARGIN + 18, y: y + 80, size: 16, font: bold, color: NAVY });
    page.drawText("Puerto Rico", { x: MARGIN + 18, y: y + 60, size: 10, font: regular, color: GRAY });
  }

  const urlLines = wrapPdfText(property.canonicalUrl, regular, 8, CONTENT_WIDTH - 160);
  drawLines(page, urlLines.slice(0, 2), { x: MARGIN + 18, y: y + 24, font: regular, size: 8, color: GRAY, lineHeight: 10 });
}

async function embedImages(pdf: PDFDocument, assets: BrochureImageAsset[]) {
  const embedded: EmbeddedImage[] = [];
  for (const source of assets) {
    try {
      const image = source.format === "png"
        ? await pdf.embedPng(source.bytes)
        : await pdf.embedJpg(source.bytes);
      embedded.push({ image, source });
    } catch {
      // An otherwise valid brochure must survive one malformed optional image.
    }
  }
  return embedded;
}

export async function buildPropertyBrochure(input: BuildPropertyBrochureInput) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const images = await embedImages(pdf, input.images);
  const qrImage = await pdf.embedPng(input.qrPng);
  let logo: PDFImage | null = null;
  if (input.logoPng) {
    try { logo = await pdf.embedPng(input.logoPng); } catch { logo = null; }
  }

  pdf.setTitle(normalizePdfText(`${input.property.title} - Brochure`));
  pdf.setAuthor("Erickson Real Estate");
  pdf.setSubject("Brochure de propiedad");
  pdf.setCreator("Borikí");
  pdf.setProducer("Borikí · pdf-lib 1.17.1");

  const cover = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  cover.drawRectangle({ x: 0, y: PAGE_HEIGHT - 18, width: PAGE_WIDTH, height: 18, color: NAVY });
  cover.drawRectangle({ x: 0, y: PAGE_HEIGHT - 21, width: PAGE_WIDTH, height: 3, color: GOLD });
  if (logo) {
    const fitted = logo.scaleToFit(74, 54);
    cover.drawImage(logo, { x: MARGIN, y: PAGE_HEIGHT - 84, width: fitted.width, height: fitted.height });
  } else {
    cover.drawText("ERICKSON REAL ESTATE", { x: MARGIN, y: PAGE_HEIGHT - 60, size: 11, font: bold, color: NAVY });
  }

  const badgeY = PAGE_HEIGHT - 82;
  let badgeX = PAGE_WIDTH - MARGIN;
  const badges = [statusLabel(input.property.status), transactionLabel(input.property.transactionType)];
  if (input.property.featured) badges.push("Destacada");
  for (const badge of badges.reverse()) {
    const width = bold.widthOfTextAtSize(normalizePdfText(badge), 9) + 22;
    badgeX -= width;
    drawBadge(cover, badge, badgeX, badgeY, bold, badge !== transactionLabel(input.property.transactionType));
    badgeX -= 7;
  }

  const heroY = 384;
  const heroHeight = 286;
  if (images[0]) drawImageCover(cover, images[0].image, MARGIN, heroY, CONTENT_WIDTH, heroHeight);
  else drawBrandedPlaceholder(cover, MARGIN, heroY, CONTENT_WIDTH, heroHeight, bold);

  const titleLines = wrapPdfText(input.property.title, bold, 25, CONTENT_WIDTH).slice(0, 3);
  let y = drawLines(cover, titleLines, { x: MARGIN, y: 345, font: bold, size: 25, color: NAVY, lineHeight: 29 });
  const location = [input.property.sector, input.property.municipality, "Puerto Rico"].filter(Boolean).join(", ");
  y -= 2;
  cover.drawText(normalizePdfText(location), { x: MARGIN, y, size: 11, font: regular, color: GRAY });
  y -= 31;
  cover.drawText(formatBrochurePrice(input.property.price, input.property.transactionType), { x: MARGIN, y, size: 23, font: bold, color: NAVY });

  const metrics = propertyBrochureMetrics(input.property);
  if (metrics.length > 0) {
    const metricY = Math.max(74, y - 94);
    const cellWidth = CONTENT_WIDTH / metrics.length;
    cover.drawRectangle({ x: MARGIN, y: metricY, width: CONTENT_WIDTH, height: 68, color: LIGHT_GRAY, borderColor: BORDER, borderWidth: 1 });
    metrics.forEach((metric, index) => {
      const x = MARGIN + cellWidth * index;
      if (index > 0) cover.drawLine({ start: { x, y: metricY + 12 }, end: { x, y: metricY + 56 }, thickness: 1, color: BORDER });
      cover.drawText(normalizePdfText(metric.label.toUpperCase()), { x: x + 12, y: metricY + 43, size: 7.5, font: bold, color: GOLD });
      cover.drawText(normalizePdfText(metric.value), { x: x + 12, y: metricY + 21, size: 11, font: bold, color: NAVY });
    });
  }

  const descriptionPages: Array<{ page: PDFPage; remainingY: number }> = [];
  let descriptionPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawPageHeader(descriptionPage, "Detalles de la propiedad", bold);
  let descriptionY = PAGE_HEIGHT - 118;
  const paragraphs = normalizePdfText(input.property.description).split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const effectiveParagraphs = paragraphs.length > 0 ? paragraphs : ["Información detallada disponible en borikipr.com."];

  for (const paragraph of effectiveParagraphs) {
    const lines = wrapPdfText(paragraph, regular, 10.5, CONTENT_WIDTH);
    for (const line of lines) {
      if (descriptionY < 62) {
        descriptionPages.push({ page: descriptionPage, remainingY: descriptionY });
        descriptionPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawPageHeader(descriptionPage, "Detalles de la propiedad (continuación)", bold);
        descriptionY = PAGE_HEIGHT - 118;
      }
      descriptionPage.drawText(line, { x: MARGIN, y: descriptionY, size: 10.5, font: regular, color: BLACK });
      descriptionY -= 15;
    }
    descriptionY -= 8;
  }
  descriptionPages.push({ page: descriptionPage, remainingY: descriptionY });

  const secondaryImages = images.slice(1, 6);
  let contactPage: PDFPage;
  let contactY: number;
  if (secondaryImages.length > 0) {
    const gallery = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawPageHeader(gallery, "Galería", bold);
    const gap = 10;
    const cellWidth = (CONTENT_WIDTH - gap) / 2;
    const cellHeight = 126;
    secondaryImages.forEach(({ image }, index) => {
      const row = Math.floor(index / 2);
      const column = index % 2;
      const x = MARGIN + column * (cellWidth + gap);
      const photoY = PAGE_HEIGHT - 112 - (row + 1) * cellHeight - row * gap;
      drawImageCover(gallery, image, x, photoY, cellWidth, cellHeight);
    });
    contactPage = gallery;
    contactY = 36;
  } else {
    const finalDescription = descriptionPages[descriptionPages.length - 1];
    if (finalDescription.remainingY >= 222) {
      contactPage = finalDescription.page;
      contactY = 36;
    } else {
      contactPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawPageHeader(contactPage, "Contacto", bold);
      contactY = PAGE_HEIGHT - 260;
    }
  }
  drawContactBlock(contactPage, { y: contactY, property: input.property, qrImage, regular, bold });

  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    page.drawLine({ start: { x: MARGIN, y: 24 }, end: { x: PAGE_WIDTH - MARGIN, y: 24 }, thickness: 0.5, color: BORDER });
    page.drawText("borikipr.com", { x: MARGIN, y: 10, size: 7.5, font: regular, color: GRAY });
    const pageLabel = `${index + 1} / ${pages.length}`;
    page.drawText(pageLabel, { x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(pageLabel, 7.5), y: 10, size: 7.5, font: regular, color: GRAY });
  });

  const bytes = await pdf.save({ useObjectStreams: true });
  return { bytes, pageCount: pages.length, embeddedImageCount: images.length };
}
