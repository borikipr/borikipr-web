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

async function listarPropiedades() {
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

  console.log("\n📋 Propiedades:");
  console.table(rows);
}

async function insertarPropiedad() {
  const slug = await rl.question("Slug: ");
  const titulo = await rl.question("Título: ");
  const descripcion = await rl.question("Descripción: ");
  const municipio = await rl.question("Municipio: ");
  const precio = Number(await rl.question("Precio: "));
  const tipo_negocio = await rl.question("Tipo negocio (venta/renta): ");
  const tipo_propiedad = await rl.question(
    "Tipo propiedad (Casa/Apartamento/Condominio/Terreno): "
  );
  const habitaciones = Number(await rl.question("Habitaciones: "));
  const banos = Number(await rl.question("Baños: "));
  const estacionamientos = Number(await rl.question("Estacionamientos: "));
  const metros_cuadrados = Number(await rl.question("Pies cuadrados: "));
  const estado = await rl.question(
    "Estado (disponible/bajo_contrato/vendida/rentada): "
  );
  const destacadoInput = await rl.question("¿Destacado? (si/no): ");
  const destacado = destacadoInput.toLowerCase() === "si";

  const imagenesInput = await rl.question(
    "Imágenes (separa rutas por coma, ej: /propiedades/a.jpg,/propiedades/b.jpg): "
  );
  const imagenes = imagenesInput
    .split(",")
    .map((i) => i.trim())
    .filter(Boolean);

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
      ${slug},
      ${titulo},
      ${descripcion},
      ${municipio},
      ${precio},
      ${tipo_negocio},
      ${tipo_propiedad},
      ${habitaciones},
      ${banos},
      ${estacionamientos},
      ${metros_cuadrados},
      ${estado},
      ${destacado}
    )
    RETURNING id, slug, titulo
  `;

  for (let i = 0; i < imagenes.length; i++) {
    await sql`
      INSERT INTO propiedad_imagenes (propiedad_id, url, orden)
      VALUES (${insertada.id}, ${imagenes[i]}, ${i + 1})
    `;
  }

  console.log("\n✅ Propiedad insertada:");
  console.table([insertada]);
}

async function editarPropiedad() {
  const slugActual = await rl.question("Slug de la propiedad a editar: ");

  const existente = await sql`
    SELECT *
    FROM propiedades
    WHERE slug = ${slugActual}
    LIMIT 1
  `;

  if (!existente[0]) {
    console.log("\n⚠️ No se encontró ninguna propiedad con ese slug.");
    return;
  }

  const actual = existente[0];

  const titulo =
    (await rl.question(`Título [${actual.titulo}]: `)) || actual.titulo;
  const descripcion =
    (await rl.question(`Descripción [actual]: `)) || actual.descripcion;
  const municipio =
    (await rl.question(`Municipio [${actual.municipio}]: `)) || actual.municipio;
  const precioInput = await rl.question(`Precio [${actual.precio}]: `);
  const precio = precioInput ? Number(precioInput) : Number(actual.precio);

  const tipo_negocio =
    (await rl.question(`Tipo negocio [${actual.tipo_negocio}]: `)) ||
    actual.tipo_negocio;
  const tipo_propiedad =
    (await rl.question(`Tipo propiedad [${actual.tipo_propiedad}]: `)) ||
    actual.tipo_propiedad;

  const habitacionesInput = await rl.question(
    `Habitaciones [${actual.habitaciones}]: `
  );
  const habitaciones = habitacionesInput
    ? Number(habitacionesInput)
    : actual.habitaciones;

  const banosInput = await rl.question(`Baños [${actual.banos}]: `);
  const banos = banosInput ? Number(banosInput) : actual.banos;

  const estacionamientosInput = await rl.question(
    `Estacionamientos [${actual.estacionamientos}]: `
  );
  const estacionamientos = estacionamientosInput
    ? Number(estacionamientosInput)
    : actual.estacionamientos;

  const metrosInput = await rl.question(
    `Pies cuadrados [${actual.metros_cuadrados}]: `
  );
  const metros_cuadrados = metrosInput
    ? Number(metrosInput)
    : actual.metros_cuadrados;

  const estado =
    (await rl.question(`Estado [${actual.estado}]: `)) || actual.estado;

  const destacadoInput = await rl.question(
    `¿Destacado? (si/no) [${actual.destacado ? "si" : "no"}]: `
  );
  const destacado = destacadoInput
    ? destacadoInput.toLowerCase() === "si"
    : actual.destacado;

  const [editada] = await sql`
    UPDATE propiedades
    SET
      titulo = ${titulo},
      descripcion = ${descripcion},
      municipio = ${municipio},
      precio = ${precio},
      tipo_negocio = ${tipo_negocio},
      tipo_propiedad = ${tipo_propiedad},
      habitaciones = ${habitaciones},
      banos = ${banos},
      estacionamientos = ${estacionamientos},
      metros_cuadrados = ${metros_cuadrados},
      estado = ${estado},
      destacado = ${destacado}
    WHERE slug = ${slugActual}
    RETURNING id, slug, titulo, precio, estado
  `;

  console.log("\n✅ Propiedad editada:");
  console.table([editada]);
}

async function borrarPropiedad() {
  const slug = await rl.question("Slug de la propiedad a borrar: ");
  const confirmar = await rl.question(
    `Escribe BORRAR para confirmar eliminación de "${slug}": `
  );

  if (confirmar !== "BORRAR") {
    console.log("\n❌ Acción cancelada.");
    return;
  }

  const [eliminada] = await sql`
    DELETE FROM propiedades
    WHERE slug = ${slug}
    RETURNING id, slug, titulo
  `;

  if (!eliminada) {
    console.log("\n⚠️ No se encontró ninguna propiedad con ese slug.");
    return;
  }

  console.log("\n🗑️ Propiedad borrada:");
  console.table([eliminada]);
}

async function main() {
  try {
    console.log("\n=== ADMIN PROPIEDADES ===");
    console.log("1. Listar propiedades");
    console.log("2. Insertar propiedad");
    console.log("3. Editar propiedad");
    console.log("4. Borrar propiedad");

    const opcion = await rl.question("\nElige una opción (1-4): ");

    if (opcion === "1") {
      await listarPropiedades();
    } else if (opcion === "2") {
      await insertarPropiedad();
    } else if (opcion === "3") {
      await editarPropiedad();
    } else if (opcion === "4") {
      await borrarPropiedad();
    } else {
      console.log("\n⚠️ Opción no válida.");
    }
  } catch (error) {
    console.error("\n❌ Error:");
    console.error(error);
  } finally {
    await rl.close();
    await sql.end();
  }
}

main();