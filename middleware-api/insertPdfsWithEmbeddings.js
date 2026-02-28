import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { pool } from "./src/db.js";

/* =========================
   __dirname em ESM
========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================
   Configuração
========================= */
const OLLAMA_URL = "http://127.0.0.1:11434";
const EMBED_MODEL = "nomic-embed-text";
const CHUNK_SIZE = 1000;

/* =========================
   Extrair texto do PDF
========================= */
async function extractTextFromPdf(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjs.getDocument({ data }).promise;

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const pageText = content.items
      .map(item => item.str)
      .join(" ");

    fullText += pageText + "\n";
  }

  return fullText.trim();
}

/* =========================
   Gerar embedding
========================= */
async function embedText(text) {
  const res = await axios.post(`${OLLAMA_URL}/api/embeddings`, {
    model: EMBED_MODEL,
    prompt: text
  });

  if (!Array.isArray(res.data?.embedding)) {
    throw new Error("Embedding inválido devolvido pelo Ollama");
  }

  return res.data.embedding;
}

/* =========================
   Chunking
========================= */
function splitTextIntoChunks(text, size = CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

/* =========================
   Inserir PDF + embeddings
========================= */
async function insertPdfWithEmbeddings(filePath, categoriaNome) {
  const filename = path.basename(filePath);

  const text = await extractTextFromPdf(filePath);

  if (!text) {
    console.warn(`⚠️ PDF "${filename}" sem texto.`);
    return;
  }

  const chunks = splitTextIntoChunks(text);

  const pdfRes = await pool.query(
    `INSERT INTO pdf_documents (filename, categoria_nome)
     VALUES ($1, $2)
     RETURNING pdf_id`,
    [filename, categoriaNome]
  );

  const pdfId = pdfRes.rows[0].pdf_id;

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i]);
    const embeddingVector = `[${embedding.join(",")}]`;

    await pool.query(
      `INSERT INTO rag_chunks (pdf_id, content, page_num, embedding)
       VALUES ($1, $2, $3, $4)`,
      [pdfId, chunks[i], i + 1, embeddingVector]
    );
  }

  console.log(`✅ PDF "${filename}" inserido (${chunks.length} chunks)`);
}

/* =========================
   Main
========================= */
async function main() {
  const basePath = path.join(__dirname, "pdfs");

  try {
    const folders = fs
      .readdirSync(basePath, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const folder of folders) {
      const categoria = folder.name;
      const folderPath = path.join(basePath, categoria);

      const files = fs
        .readdirSync(folderPath)
        .filter(f => f.toLowerCase().endsWith(".pdf"));

      for (const file of files) {
        console.log(`📄 Processando "${file}" [${categoria}]`);
        await insertPdfWithEmbeddings(
          path.join(folderPath, file),
          categoria
        );
      }
    }

    console.log("🎉 Todos os PDFs processados.");
  } finally {
    await pool.end();
  }
}

main();
