import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runSyntheticMaximumPdfDrill } from "../../lib/signatures/prototype/maximum-drill";

async function main() {
  const outputDirectory = path.join(process.cwd(), "tmp", "pdfs", "signature-maximum-drill");
  await mkdir(outputDirectory, { recursive: true });
  const result = await runSyntheticMaximumPdfDrill();
  await Promise.all([
    writeFile(path.join(outputDirectory, "source.pdf"), result.sourceBytes),
    writeFile(path.join(outputDirectory, "final.pdf"), result.finalBytes),
  ]);
  console.log(JSON.stringify({ outputDirectory, metrics: result.metrics }));
}

main().catch(() => {
  console.error("Synthetic maximum PDF drill failed; document contents were suppressed.");
  process.exitCode = 1;
});
