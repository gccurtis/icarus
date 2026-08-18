import fs from "node:fs";
const S = process.env.SCRATCH;
const base = "node_modules/@fontsource";
const faces = [
  ["IBM Plex Sans", 400, `${base}/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2`],
  ["IBM Plex Sans", 500, `${base}/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2`],
  ["IBM Plex Sans", 600, `${base}/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2`],
  ["IBM Plex Mono", 400, `${base}/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2`],
  ["IBM Plex Mono", 500, `${base}/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2`]
];
const out = ["<style>"];
let total = 0;
for (const [fam, w, p] of faces) {
  if (!fs.existsSync(p)) { console.log("MISSING", p); continue; }
  const b = fs.readFileSync(p).toString("base64");
  total += b.length;
  out.push(`@font-face{font-family:"${fam}";font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b}) format("woff2");}`);
}
out.push("</style>");
fs.writeFileSync(`${S}/fonts.html`, out.join("\n"));
console.log("ok base64 chars", total, "~KB", Math.round(total / 1024));
