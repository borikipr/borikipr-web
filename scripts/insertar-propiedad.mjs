import postgres from "postgres";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está configurada en .env.local");
}

const sql = postgres(connectionString, {
  ssl: "require",
});

const propiedad = {
  slug: "casa-ejemplo-carolina",
  titulo: "Casa ejemplo en Carolina",
  descripcion:
    "Propiedad espaciosa con excelente ubicación, ideal para familia y con acceso conveniente a zonas comerciales.",
  municipio: "Carolina",
  precio: 325000,
  tipo_negocio: "venta", // venta | renta
  tipo_propiedad: "Casa", // Casa | Apartamento | Condominio | Terreno
  habitaciones: 3,
  banos: 2,
  estacionamientos: 2,
  metros_cuadrados: 2200,
  estado: "disponible", // disponible | bajo_contrato | vendida | rentada
  destacado: true,
  imagenes: [
    "/propiedades/carolina-1.jpg",
    "/propiedades/carolina-2.jpg",
    "/propiedades/carolina-3.jpg",
  ],
};

async function main() {
  try {
    const [insertada] = await sql`
      INSERT INTO propiedades (
        slug,
        titulo,
        descripcion,
        municipio,
        precio,
        tipo_negocio,
        tipo_propiedad,
        habitaciones,
        banos,
        estacionamientos,
        metros_cuadrados,
        estado,
        destacado
      ) VALUES (
        ${propiedad.slug},
        ${propiedad.titulo},
        ${propiedad.descripcion},
        ${propiedad.municipio},
        ${propiedad.precio},
        ${propiedad.tipo_negocio},
        ${propiedad.tipo_propiedad},
        ${propiedad.habitaciones},
        ${propiedad.banos},
        ${propiedad.estacionamientos},
        ${propiedad.metros_cuadrados},
        ${propiedad.estado},
        ${propiedad.destacado}
      )
      RETURNING id, titulo, slug
    `;

    for (let i = 0; i < propiedad.imagenes.length; i++) {
      await sql`
        INSERT INTO propiedad_imagenes (propiedad_id, url, orden)
        VALUES (${insertada.id}, ${propiedad.imagenes[i]}, ${i + 1})
      `;
    }

    console.log("✅ Propiedad insertada correctamente:");
    console.log(insertada);
  } catch (error) {
    console.error("❌ Error insertando propiedad:");
    console.error(error);
  } finally {
    await sql.end();
  }
}

main();