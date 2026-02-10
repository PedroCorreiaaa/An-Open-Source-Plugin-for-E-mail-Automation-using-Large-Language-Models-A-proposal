const mod = require("pdf-parse");

let pdfParse = mod;

if (typeof pdfParse !== "function" && typeof pdfParse?.default === "function") {
  pdfParse = pdfParse.default;
}

if (
  typeof pdfParse !== "function" &&
  typeof pdfParse?.default?.default === "function"
) {
  pdfParse = pdfParse.default.default;
}

if (typeof pdfParse !== "function") {
  throw new Error("Não foi possível resolver pdf-parse para uma função");
}

module.exports = async function parsePdf(buffer) {
  return await pdfParse(buffer);
};
