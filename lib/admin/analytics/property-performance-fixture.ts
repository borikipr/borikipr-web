import type {
  PropertyPerformanceMetadata,
  PropertyPerformanceResult,
} from "./property-performance";

export const PROPERTY_PERFORMANCE_FIXTURE_RESULT: PropertyPerformanceResult = {
  status: "available",
  range: "30d",
  requestCount: 3,
  unavailableSections: [],
  rows: [
    {
      propertySlug: "hacienda-monte-carmelo-cascadas-cafe",
      views: 128,
      shares: 19,
      whatsappClicks: 11,
      contactClicks: 7,
      priorityRegistrationsSubmitted: 2,
      buyerProfilesSubmitted: 3,
      showingProfilesSubmitted: 1,
      shareChannels: { whatsapp: 8, facebook: 4, copy: 5, qr: 2 },
      sharedLinkArrivals: 31,
    },
    {
      propertySlug: "casa-cotolaurel-ponce",
      views: 74,
      shares: 9,
      whatsappClicks: 6,
      contactClicks: 3,
      priorityRegistrationsSubmitted: 0,
      buyerProfilesSubmitted: 2,
      showingProfilesSubmitted: 1,
      shareChannels: { whatsapp: 3, facebook: 2, copy: 3, qr: 1 },
      sharedLinkArrivals: 14,
    },
    {
      propertySlug: "listado-historico",
      views: 21,
      shares: 2,
      whatsappClicks: 1,
      contactClicks: 0,
      priorityRegistrationsSubmitted: 0,
      buyerProfilesSubmitted: 0,
      showingProfilesSubmitted: 0,
      shareChannels: { whatsapp: 1, facebook: 0, copy: 1, qr: 0 },
      sharedLinkArrivals: 3,
    },
  ],
};

export const PROPERTY_PERFORMANCE_FIXTURE_METADATA: PropertyPerformanceMetadata[] = [
  {
    slug: "hacienda-monte-carmelo-cascadas-cafe",
    title: "Hacienda Monte Carmelo: Cascadas & Café",
    status: "disponible",
    municipality: "Guayanilla",
  },
  {
    slug: "casa-cotolaurel-ponce",
    title: "Propiedad en Coto Laurel",
    status: "bajo_contrato",
    municipality: "Ponce",
  },
];
