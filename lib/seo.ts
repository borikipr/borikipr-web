export const SITE_URL = "https://borikipr.com";
export const SITE_NAME = "Erickson Real Estate";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export function absoluteUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function jsonLdScript(data: unknown) {
  return {
    __html: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

export function realEstateAgentJsonLdForLocale(locale: "es-PR" | "en-US") {
  return {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  "@id": `${SITE_URL}/#real-estate-agent`,
  name: SITE_NAME,
  legalName: SITE_NAME,
  url: SITE_URL,
  image: DEFAULT_OG_IMAGE,
  areaServed: {
    "@type": "AdministrativeArea",
    name: "Puerto Rico",
  },
  founder: {
    "@type": "Person",
    name: "Ivonne Erickson",
    jobTitle: locale === "en-US" ? "Real Estate Broker" : "Corredora de Bienes Raíces",
  },
  identifier: {
    "@type": "PropertyValue",
    name: "Licencia",
    value: "C-25961",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    telephone: "+1-787-677-4900",
    areaServed: "PR",
    availableLanguage: ["Spanish", "English"],
  },
  };
}

export const realEstateAgentJsonLd = realEstateAgentJsonLdForLocale("es-PR");
