import { build } from "esbuild";
import {
  mkdir,
  copyFile,
  readFile,
  writeFile,
  readdir,
} from "node:fs/promises";

await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/main.jsx"],
  bundle: true,
  minify: true,
  outfile: "dist/app.js",
  target: ["es2020"],
  legalComments: "eof",
  define: { "process.env.NODE_ENV": '"production"' },
});
await Promise.all([
  copyFile("index.html", "dist/index.html"),
  copyFile("src/style.css", "dist/style.css"),
  copyFile(
    "node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2",
    "dist/dm-sans.woff2",
  ),
  copyFile(
    "node_modules/@fontsource/dm-sans/files/dm-sans-latin-600-normal.woff2",
    "dist/dm-sans-semibold.woff2",
  ),
]);
let notices = "";
for (const pkg of [
  "react",
  "react-dom",
  "scheduler",
  "lucide-react",
  "@fontsource/dm-sans",
]) {
  const dir = "node_modules/" + pkg;
  const license = (await readdir(dir)).find((f) => /^licen[sc]e/i.test(f));
  notices +=
    "\n\n" + pkg + "\n" + (await readFile(dir + "/" + license, "utf8"));
}
await writeFile("dist/THIRD-PARTY-NOTICES.txt", notices);
