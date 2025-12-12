import { pool } from "../db.js";

export default async function keywordRoutes(fastify, opts) {
    // GET /implementacao/:id_implementacao/categoria/:id_categoria/keywords
    fastify.get("/implementacao/:id_implementacao/categoria/:id_categoria/keywords", async (request, reply) => {
    const { id_implementacao, id_categoria } = request.params;

    try {
        // Consulta as keywords associadas à categoria de uma implementação
        const { rows } = await pool.query(
        `SELECT k.id_keyword, k.keyword
        FROM keyword k
        WHERE k.id_categoria = $1`,
        [id_categoria]
        );

        if (rows.length === 0) {
        return reply.code(404).send({ error: "Nenhuma keyword encontrada para esta categoria" });
        }

        reply.send(rows);
    } catch (err) {
        request.log.error(err);
        reply.code(500).send({ error: "Erro ao listar keywords" });
    }
    });

    // POST /implementacao/:id_implementacao/categoria/:id_categoria/keyword
    fastify.post("/implementacao/:id_implementacao/categoria/:id_categoria/keyword", async (request, reply) => {
    const { id_implementacao, id_categoria } = request.params;
    const { keyword } = request.body;

    if (!keyword) {
        return reply.code(400).send({ error: "Campo 'keyword' é obrigatório" });
    }

    try {
        // Insere uma nova keyword na categoria
        const result = await pool.query(
        `INSERT INTO keyword (id_categoria, keyword)
        VALUES ($1, $2) RETURNING *`,
        [id_categoria, keyword]
        );

        reply.code(201).send({
        message: "Keyword adicionada com sucesso",
        keyword: result.rows[0],
        });
    } catch (err) {
        request.log.error(err);
        reply.code(500).send({ error: "Erro ao adicionar keyword" });
    }
    });

    // DELETE /implementacao/:id_implementacao/categoria/:id_categoria/keyword/:id_keyword
    fastify.delete("/implementacao/:id_implementacao/categoria/:id_categoria/keyword/:id_keyword", async (request, reply) => {
    const { id_implementacao, id_categoria, id_keyword } = request.params;

    try {
        const result = await pool.query(
        `DELETE FROM keyword
        WHERE id_keyword = $1 AND id_categoria = $2
        RETURNING *`,
        [id_keyword, id_categoria]
        );

        if (result.rows.length === 0) {
        return reply.code(404).send({ error: "Keyword não encontrada" });
        }

        reply.send({
        message: "Keyword excluída com sucesso",
        keyword: result.rows[0],
        });
    } catch (err) {
        request.log.error(err);
        reply.code(500).send({ error: "Erro ao excluir keyword" });
    }
    });

}
