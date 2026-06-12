import type { MetadataRoute } from "next";
import { getPropiedades, type PropiedadQueryRow } from "@/lib/queries/propiedades";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://borikipr.com";

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/listados`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/testimonios`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  let propiedades: PropiedadQueryRow[] = [];

  try {
    propiedades = await getPropiedades();
  } catch (error) {
    console.warn(
      "SITEMAP WARNING: no se pudieron cargar las propiedades; se usaran solo rutas estaticas.",
      error
    );
  }

  const propiedadesPages: MetadataRoute.Sitemap = propiedades.map((item) => ({
    url: `${baseUrl}/listados/${item.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: item.destacado ? 0.8 : 0.6,
  }));

  return [...staticPages, ...propiedadesPages];
}
