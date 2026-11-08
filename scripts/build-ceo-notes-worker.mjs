import { readFile, writeFile } from "node:fs/promises";

const notesDir = new URL("../notes/", import.meta.url);
const workerUrl = new URL("../notes/_worker.js", import.meta.url);

const [html, css, radioJs, posts, worker] = await Promise.all([
  readFile(new URL("index.html", notesDir), "utf8"),
  readFile(new URL("radio.css", notesDir), "utf8"),
  readFile(new URL("radio.js", notesDir), "utf8"),
  readFile(new URL("posts.json", notesDir), "utf8"),
  readFile(workerUrl, "utf8")
]);

const lines = worker.split("\n");
const expectedNames = ["const HTML=", "const RADIO_CSS=", "const RADIO_JS=", "const POSTS="];
for (let i = 0; i < expectedNames.length; i += 1) {
  if (!lines[i]?.startsWith(expectedNames[i])) {
    throw new Error("Unexpected Pages Worker header at line " + (i + 1));
  }
}

const runtime = lines.slice(4).join("\n");
const generated = [
  "const HTML=" + JSON.stringify(html) + ";",
  "const RADIO_CSS=" + JSON.stringify(css) + ";",
  "const RADIO_JS=" + JSON.stringify(radioJs) + ";",
  "const POSTS=" + JSON.stringify(posts) + ";",
  runtime
].join("\n");

if (process.argv.includes("--write")) {
  await writeFile(workerUrl, generated, "utf8");
  console.log("CEO Notes Pages Worker regenerated from index.html, radio.css, radio.js, and posts.json.");
} else if (generated !== worker) {
  console.error("CEO Notes Pages Worker is out of sync. Run: node scripts/build-ceo-notes-worker.mjs --write");
  process.exitCode = 1;
} else {
  console.log("CEO Notes Pages Worker is synchronized with its source files.");
}
