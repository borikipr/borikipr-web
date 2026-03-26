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

async function main() {
  try {
    const rows = await sql`
      SELECT
        id,
        slug,
        titulo,
        municipio,
        precio,
        tipo_negocio,
        tipo_propiedad,
        estado,
        destacado,
        created_at
      FROM propiedades
      ORDER BY created_at DESC
    `;

    console.log("📋 Propiedades en la base de datos:");
    console.table(rows);
  } catch (error) {
    console.error("❌ Error listando propiedades:");
    console.error(error);
  } finally {
    await sql.end();
  }
}

main();