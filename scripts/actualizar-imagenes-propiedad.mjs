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

async function main() {
  try {
    const slug = await rl.question("Slug de la propiedad: ");

    const propiedad = await sql`
      SELECT id, slug, titulo
      FROM propiedades
      WHERE slug = ${slug}
      LIMIT 1
    `;

    if (!propiedad[0]) {
      console.log("\n⚠️ No se encontró ninguna propiedad con ese slug.");
      return;
    }

    const propiedadId = propiedad[0].id;

    console.log("\nPropiedad encontrada:");
    console.table(propiedad);

    const actuales = await sql`
      SELECT id, url, orden
      FROM propiedad_imagenes
      WHERE propiedad_id = ${propiedadId}
      ORDER BY orden ASC
    `;

    console.log("\nImágenes actuales:");
    console.table(actuales);

    const confirmar = await rl.question(
      "\nEsto borrará las imágenes actuales y pondrá las nuevas. Escribe SI para continuar: "
    );

    if (confirmar !== "SI") {
      console.log("\n❌ Acción cancelada.");
      return;
    }

    const imagenesInput = await rl.question(
      "\nEscribe las nuevas rutas separadas por coma:\nEjemplo: /propiedades/casa-1.jpg,/propiedades/casa-2.jpg\n\n> "
    );

    const imagenes = imagenesInput
      .split(",")
      .map((img) => img.trim())
      .filter(Boolean);

    await sql`
      DELETE FROM propiedad_imagenes
      WHERE propiedad_id = ${propiedadId}
    `;

    for (let i = 0; i < imagenes.length; i++) {
      await sql`
        INSERT INTO propiedad_imagenes (propiedad_id, url, orden)
        VALUES (${propiedadId}, ${imagenes[i]}, ${i + 1})
      `;
    }

    const nuevas = await sql`
      SELECT id, url, orden
      FROM propiedad_imagenes
      WHERE propiedad_id = ${propiedadId}
      ORDER BY orden ASC
    `;

    console.log("\n✅ Imágenes actualizadas correctamente:");
    console.table(nuevas);
  } catch (error) {
    console.error("\n❌ Error actualizando imágenes:");
    console.error(error);
  } finally {
    await rl.close();
    await sql.end();
  }
}

main();