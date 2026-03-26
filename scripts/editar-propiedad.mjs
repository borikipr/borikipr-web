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

// Cambia estos valores según la propiedad que quieras editar
const slugActual = "residencia-moderna-guaynabo";

const cambios = {
  titulo: "Residencia moderna con piscina renovada",
  descripcion:
    "Propiedad moderna con diseño contemporáneo, amplios espacios interiores, piscina privada y mejoras recientes.",
  municipio: "Guaynabo",
  precio: 710000,
  tipo_negocio: "venta",
  tipo_propiedad: "Casa",
  habitaciones: 4,
  banos: 3,
  estacionamientos: 2,
  metros_cuadrados: 3300,
  estado: "disponible",
  destacado: true,
};

async function main() {
  try {
    const [editada] = await sql`
      UPDATE propiedades
      SET
        titulo = ${cambios.titulo},
        descripcion = ${cambios.descripcion},
        municipio = ${cambios.municipio},
        precio = ${cambios.precio},
        tipo_negocio = ${cambios.tipo_negocio},
        tipo_propiedad = ${cambios.tipo_propiedad},
        habitaciones = ${cambios.habitaciones},
        banos = ${cambios.banos},
        estacionamientos = ${cambios.estacionamientos},
        metros_cuadrados = ${cambios.metros_cuadrados},
        estado = ${cambios.estado},
        destacado = ${cambios.destacado}
      WHERE slug = ${slugActual}
      RETURNING id, slug, titulo, precio, estado
    `;

    if (!editada) {
      console.log("⚠️ No se encontró ninguna propiedad con ese slug.");
      return;
    }

    console.log("✅ Propiedad editada correctamente:");
    console.table([editada]);
  } catch (error) {
    console.error("❌ Error editando propiedad:");
    console.error(error);
  } finally {
    await sql.end();
  }
}

main();