// Baut aus src/ eine einzelne, eigenständige HTML-Datei: dist/Reise-Protokoll.html
// Die JS-Dateien aus src/js/ werden nach Dateinamen sortiert aneinandergehängt.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const pkg = JSON.parse(read("package.json"));

const js = readdirSync(join(root, "src/js"))
  .filter((f) => f.endsWith(".js"))
  .sort()
  .map((f) => `/* ===== ${f} ===== */\n` + read("src/js/" + f).trimEnd())
  .join("\n\n");

const html = read("src/index.html")
  .replace("/*__STYLES__*/", () => read("src/styles.css").trimEnd())
  .replace("/*__APP__*/", () => js)
  .replace("__VERSION__", "v" + pkg.version);

mkdirSync(join(root, "dist"), { recursive: true });
const doc = '<!doctype html><html lang="de"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Reise-Protokoll</title></head><body>' + html + "</body></html>\n";
writeFileSync(join(root, "dist/Reise-Protokoll.html"), doc);
console.log(`dist/Reise-Protokoll.html gebaut – v${pkg.version}, ${(html.length / 1e3).toFixed(0)} KB`);
