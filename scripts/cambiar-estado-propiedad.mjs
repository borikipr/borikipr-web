import postgres from "postgres";
import dotenv from "dotenv";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "node:process";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está configurada en .env.local");
}

const sql = postgres(connectionString, {
  ssl: "require",
});

const rl = readline.createInterface({ input, output });

const estadosValidos = [
  "disponible",
  "bajo_contrato",
  "vendida",
  "rentada",
];

async function main() {
  try {
    const slug = await rl.question("Slug de la propiedad: ");

    const propiedad = await sql`
      SELECT id, slug, titulo, estado
      FROM propiedades
      WHERE slug = ${slug}
      LIMIT 1
    `;

    if (!propiedad[0]) {
      console.log("\n⚠️ No se encontró ninguna propiedad con ese slug.");
      return;
    }

    console.log("\nPropiedad encontrada:");
    console.table(propiedad);

    console.log("\nEstados válidos:");
    console.log("- disponible");
    console.log("- bajo_contrato");
    console.log("- vendida");
    console.log("- rentada");

    const nuevoEstado = await rl.question("\nNuevo estado: ");

    if (!estadosValidos.includes(nuevoEstado)) {
      console.log("\n❌ Estado no válido.");
      return;
    }

    const confirmar = await rl.question(
      `\nEscribe SI para cambiar el estado a "${nuevoEstado}": `
    );

    if (confirmar !== "SI") {
      console.log("\n❌ Acción cancelada.");
      return;
    }

    const [actualizada] = await sql`
      UPDATE propiedades
      SET estado = ${nuevoEstado}
      WHERE slug = ${slug}
      RETURNING id, slug, titulo, estado
    `;

    console.log("\n✅ Estado actualizado correctamente:");
    console.table([actualizada]);
  } catch (error) {
    console.error("\n❌ Error cambiando estado:");
    console.error(error);
  } finally {
    await rl.close();
    await sql.end();
  }
}

main();