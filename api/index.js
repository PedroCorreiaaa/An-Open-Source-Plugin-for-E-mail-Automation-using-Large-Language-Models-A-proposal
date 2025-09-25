import express from "express";
import bodyParser from "body-parser";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  user: "postgres",       // <-- ajusta para o teu utilizador
  host: "localhost",      // <-- host do PostgreSQL
  database: "emailsdb",   // <-- nome da tua BD
  password: "password",   // <-- password
  port: 5432,
});

const app = express();
app.use(bodyParser.json());

/**
 * Função para categorizar email com base em keywords
 */
async function categorizeEmail(content) {
  const res = await pool.query("SELECT id_categoria, keyword FROM keywords");
  const keywords = res.rows;

  const counts = {}; // { id_categoria: contagem }

  for (const kw of keywords) {
    const regex = new RegExp("\\b" + kw.keyword + "\\b", "gi");
    const matches = content.match(regex);
    if (matches) {
      counts[kw.id_categoria] = (counts[kw.id_categoria] || 0) + matches.length;
    }
  }

  if (Object.keys(counts).length === 0) {
    return null; // Sem correspondências
  }

  // Escolher a categoria com maior contagem
  let bestCategoria = null;
  let maxCount = 0;
  for (const [categoria, count] of Object.entries(counts)) {
    if (count > maxCount) {
      bestCategoria = categoria;
      maxCount = count;
    }
  }

  return bestCategoria;
}

/**
 * Função para gerar resposta com LLM (placeholder)
 * Substitui pela tua chamada real ao RAG/LLM
 */
async function generateLLMResponse(messageId, content) {
  try {
    // 🔹 Aqui podes trocar para chamada ao teu LLM/RAG
    const resposta = `Resposta automática para: ${content.substring(0, 80)}...`;

    // Inserir nova resposta
    const result = await pool.query(
      `INSERT INTO resposta_llm (message_id, conteudo, id_estado)
       VALUES ($1, $2, 1)
       RETURNING id_resposta`,
      [messageId, resposta]
    );

    // Atualizar email com resposta gerada
    await pool.query(
      `UPDATE email SET resposta = $1 WHERE message_id = $2`,
      [resposta, messageId]
    );

    console.log("Resposta gerada e gravada:", result.rows[0].id_resposta);
  } catch (err) {
    console.error("Erro ao gerar resposta:", err);
  }
}

/**
 * Endpoint principal
 * - categorizar → só categoriza
 * - responder → categoriza e gera resposta
 */
app.post("/process-email", async (req, res) => {
  const { messageId, threadId, remetente, assunto, corpo, acao } = req.body;

  if (!messageId || !corpo) {
    return res.status(400).json({ error: "Faltam parâmetros obrigatórios" });
  }

  try {
    // Categorizar
    const id_categoria = await categorizeEmail(corpo);

    await pool.query(
      `INSERT INTO email (message_id, id_implementacao, id_categoria, thread_id, remetente, assunto, corpo, categorizado, respondido)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, false)
       ON CONFLICT (message_id) DO UPDATE 
       SET id_categoria = EXCLUDED.id_categoria,
           categorizado = EXCLUDED.categorizado`,
      [messageId, id_categoria, threadId, remetente, assunto, corpo, id_categoria ? true : false]
    );

    // Caso seja apenas categorização
    if (acao === "categorizar") {
      return res.json({
        status: "categorizado",
        messageId,
        categoria: id_categoria,
      });
    }

    // Caso seja categorização + resposta
    res.json({
      status: "processing",
      messageId,
      categoria: id_categoria,
    });

    // Gerar resposta em background
    generateLLMResponse(messageId, corpo);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao processar email" });
  }
});

/**
 * Endpoint para obter resposta de um email
 */
app.get("/get-response/:messageId", async (req, res) => {
  const { messageId } = req.params;
  try {
    const result = await pool.query(
      "SELECT resposta FROM email WHERE message_id = $1",
      [messageId]
    );

    if (result.rows.length === 0) {
      return res.json({ resposta: null });
    }

    res.json({ resposta: result.rows[0].resposta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar resposta" });
  }
});

/**
 * Arrancar servidor
 */
app.listen(3000, () => {
  console.log("🚀 Middleware a correr em http://localhost:3000");
});
