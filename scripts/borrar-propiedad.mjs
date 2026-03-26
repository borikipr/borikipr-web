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

// Cambia este slug por la propiedad que quieras borrar
const slug = "casa-ejemplo-carolina";

async function main() {
  try {
    const [eliminada] = await sql`
      DELETE FROM propiedades
      WHERE slug = ${slug}
      RETURNING id, slug, titulo
    `;

    if (!eliminada) {
      console.log("⚠️ No se encontró ninguna propiedad con ese slug.");
      return;
    }

    console.log("🗑️ Propiedad borrada correctamente:");
    console.table([eliminada]);
  } catch (error) {
    console.error("❌ Error borrando propiedad:");
    console.error(error);
  } finally {
    await sql.end();
  }
}

main();