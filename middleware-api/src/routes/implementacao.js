import { pool } from "../db.js";

export default async function implementacaoRoutes(fastify, opts) {
  // POST /implementacao
  fastify.post("/implementacao", async (request, reply) => {
    const { email } = request.body;

    if (!email) {
      return reply.code(400).send({ error: "Campo 'email' é obrigatório" });
    }

    try {
      const result = await pool.query(
        `INSERT INTO implementacao (email)
         VALUES ($1)
         ON CONFLICT (email)
         DO UPDATE SET email = EXCLUDED.email
         RETURNING *`,
        [email]
      );

      reply.code(201).send({
        message: "Implementação registada com sucesso",
        implementacao: result.rows[0],
      });
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ error: "Erro ao criar implementação" });
    }
  });

  // GET /implementacao
  fastify.get("/implementacao", async (request, reply) => {
    try {
      const { rows } = await pool.query("SELECT * FROM implementacao");
      reply.send(rows);
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ error: "Erro ao listar implementações" });
    }
  });

  // GET /implementacao/:email
  fastify.get("/implementacao/:email", async (request, reply) => {
    const { email } = request.params;

    try {
      const { rows } = await pool.query(
        "SELECT * FROM implementacao WHERE email = $1",
        [email]
      );

      if (rows.length === 0) {
        return reply.code(404).send({ error: "Implementação não encontrada" });
      }

      reply.send(rows[0]);
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ error: "Erro ao obter implementação" });
    }
  });
}
