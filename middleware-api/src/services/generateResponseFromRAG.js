import axios from "axios";
import { pool } from "../db.js";

const OLLAMA_URL = "http://127.0.0.1:11434";
const LLM_MODEL = "llama3";
const EMBED_MODEL = "nomic-embed-text";

const RAG_TOP_K = 5;
const MAX_CONTEXT_CHARS = 4000;

/* =========================
   Conversão para pgvector
========================= */
function toPgVector(vec) {
  return `[${vec.join(",")}]`;
}

/* =========================
   Embeddings via Ollama
========================= */
async function embedText(text) {
  const res = await axios.post(`${OLLAMA_URL}/api/embeddings`, {
    model: EMBED_MODEL,
    prompt: text
  });

  if (!res.data?.embedding || !Array.isArray(res.data.embedding)) {
    throw new Error("Embedding inválido devolvido pelo Ollama");
  }

  return res.data.embedding;
}

/* =========================
   Pesquisa pgvector por categoria
========================= */
async function searchRAGContext(question, categoriaNome) {
  const embedding = await embedText(question);
  const embeddingVector = toPgVector(embedding);

  const { rows } = await pool.query(
    `
    SELECT
      c.content,
      c.pdf_id,
      c.page_num,
      d.filename,
      1 - (c.embedding <=> $1::vector) AS score
    FROM rag_chunks c
    JOIN pdf_documents d ON d.pdf_id = c.pdf_id
    WHERE d.categoria_nome = $2
    ORDER BY c.embedding <=> $1::vector
    LIMIT $3
    `,
    [embeddingVector, categoriaNome, RAG_TOP_K]
  );

  return rows; // todos os chunks encontrados
}

/* =========================
   Construção do prompt
========================= */
function buildPrompt(question, chunks) {
  let context = "";
  let total = 0;
  const sources = [];

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const block =
      `[${i + 1}] ${c.filename}#p${c.page_num}\n` +
      `${c.content}\n\n`;

    if (total + block.length > MAX_CONTEXT_CHARS) break;

    context += block;
    total += block.length;

    sources.push({
      filename: c.filename,
      page: c.page_num,
      score: c.score
    });
  }

  const prompt = `
Você é um assistente institucional automático.

REGRAS OBRIGATÓRIAS:
- A resposta deve seguir EXATAMENTE a estrutura abaixo, sem adicionar ou remover secções.
- Nunca inclua nomes próprios, cargos, assinaturas personalizadas ou contactos.
- Nunca utilize placeholders como “Seu nome”, “Nome do responsável”, ou similares.
- Não invente identidades humanas.
- Use linguagem formal, neutra e institucional.
- Caso alguma informação não esteja disponível, responda de forma genérica e factual.

FORMATO DA RESPOSTA (obrigatório):

Saudação

Corpo

Atenciosamente  
Assistente Automático AI4Governance


Se a resposta não estiver no contexto, diz claramente que não sabes.

Pergunta:
${question}

Contexto:
${context}
`;

  return { prompt, sources };
}

/* =========================
   Função principal
========================= */
async function generateResponseFromRAG(question, categoriaNome) {
  try {
    let prompt;
    let sources = [];

    //Caso sem categoria ou categoria = ".Outro"
    if (!categoriaNome || categoriaNome === ".Outro") {
      prompt = `
        Você é um assistente institucional automático.

        REGRAS OBRIGATÓRIAS:
        - A resposta deve seguir EXATAMENTE a estrutura abaixo, sem adicionar ou remover secções.
        - Nunca inclua nomes próprios, cargos, assinaturas personalizadas ou contactos.
        - Nunca utilize placeholders como “Seu nome”, “Nome do responsável”, ou similares.
        - Não invente identidades humanas.
        - Use linguagem formal, neutra e institucional.
        - Caso alguma informação não esteja disponível, responda de forma genérica e factual.

        FORMATO DA RESPOSTA (obrigatório):

        Saudação

        Corpo

        Atenciosamente  
        Assistente Automático AI4Governance

        Se a resposta não estiver no contexto, diz claramente que não sabes.
        Pergunta:
        ${question}
      `;
    } else {
      // Obter contexto RAG baseado na categoria
      const chunks = await searchRAGContext(question, categoriaNome);

      if (!chunks.length) {
        //Fallback: perguntar ao LLM sem contexto
        prompt = `
        Você é um assistente institucional automático.

        REGRAS OBRIGATÓRIAS:
        - A resposta deve seguir EXATAMENTE a estrutura abaixo, sem adicionar ou remover secções.
        - Nunca inclua nomes próprios, cargos, assinaturas personalizadas ou contactos.
        - Nunca utilize placeholders como “Seu nome”, “Nome do responsável”, ou similares.
        - Não invente identidades humanas.
        - Use linguagem formal, neutra e institucional.
        - Caso alguma informação não esteja disponível, responda de forma genérica e factual.

        FORMATO DA RESPOSTA (obrigatório):

        Saudação

        Corpo

        Atenciosamente  
        Assistente automático AI4Governance


          Se a resposta não estiver no contexto, diz claramente que não sabes.

        Pergunta:
      ${question}
      `;
      } else {
        // Construir prompt com contexto
        const built = buildPrompt(question, chunks);
        prompt = built.prompt;
        sources = built.sources;
      }
    }

    // Chamar Ollama
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: LLM_MODEL,
      prompt,
      stream: false
    });

    const json = response.data;

    if (json.error || !json.response) {
      return "⚠️ Não foi possível obter uma resposta baseada nos PDFs.";
    }

    // Anexar fontes, se houver
    let respostaGerada = json.response.trim();

    if (sources.length > 0) {
      const fontesTexto = sources
        .map(s => `- ${s.filename}, página ${s.page}`)
        .join("\n");

      respostaGerada += `\n\nFontes consultadas:\n${fontesTexto}`;
    }

    return respostaGerada;

  } catch (e) {
    console.error("Erro ao contactar RAG:", e);
    return "⚠️ Erro ao contactar o sistema RAG.";
  }
}

export default generateResponseFromRAG;
