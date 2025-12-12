import { pool } from "../db.js";

export default async function categoriaRoutes(fastify, opts) {
  // GET /implementacao/:id_implementacao/categorias
  fastify.get("/implementacao/:id_implementacao/categorias", async (request, reply) => {
    const { id_implementacao } = request.params;

    try {
      const { rows } = await pool.query(
        "SELECT * FROM categoria WHERE id_implementacao = $1",
        [id_implementacao]
      );

      if (rows.length === 0) {
        return reply.code(404).send({ error: "Nenhuma categoria encontrada" });
      }

      reply.send(rows);
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ error: "Erro ao listar categorias" });
    }
  });

  // GET /implementacao/:id_implementacao/categorias/keywords
  fastify.get("/implementacao/:id_implementacao/categorias/keywords", async (request, reply) => {
    const { id_implementacao } = request.params;

    try {
      //query
      const categoriasResult = await pool.query(
        `SELECT c.id_categoria, c.nome AS label, k.keyword
        FROM categoria c
        LEFT JOIN keyword k ON c.id_categoria = k.id_categoria
        WHERE c.id_implementacao = $1`,
        [id_implementacao]
      );

      // Agrupando as categorias e as respetivas keywords
      const categoriasJson = categoriasResult.rows.reduce((acc, row) => {
        // Encontra a categoria existente ou cria uma nova
        let categoria = acc.find(c => c.label === row.label);
        
        if (!categoria) {
          categoria = { label: row.label, keywords: [] };
          acc.push(categoria);
        }

        if (row.keyword) {
          categoria.keywords.push(row.keyword);
        }

        return acc;
      }, []);

      // Retorna o JSON no formato desejado
      reply.send(categoriasJson);
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ error: "Erro ao listar categorias e keywords" });
    }
  });

  // POST /implementacao/:id_implementacao/categoria
  fastify.post("/implementacao/:id_implementacao/categoria", async (request, reply) => {
    const { id_implementacao } = request.params;
    let { nome } = request.body;

    if (!nome) {
      return reply.code(400).send({ error: "Campo 'nome' é obrigatório" });
    }

    nome = "." + nome;

    try {
      const result = await pool.query(
        `INSERT INTO categoria (id_implementacao, nome)
         VALUES ($1, $2) RETURNING *`,
        [id_implementacao, nome]
      );

      reply.code(201).send({
        message: "Categoria criada com sucesso",
        categoria: result.rows[0],
      });
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ error: "Erro ao criar categoria" });
    }
  });

  // PUT /implementacao/:id_implementacao/categoria/:id_categoria
  fastify.put("/implementacao/:id_implementacao/categoria/:id_categoria", async (request, reply) => {
    const { id_implementacao, id_categoria } = request.params;
    let { nome } = request.body;

    if (!nome) {
      return reply.code(400).send({ error: "Campo 'nome' é obrigatório" });
    }

    nome = "." + nome;
    
    try {
      const result = await pool.query(
        `UPDATE categoria
         SET nome = $1
         WHERE id_categoria = $2 AND id_implementacao = $3
         RETURNING *`,
        [nome, id_categoria, id_implementacao]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: "Categoria não encontrada" });
      }

      reply.send({
        message: "Categoria atualizada com sucesso",
        categoria: result.rows[0],
      });
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ error: "Erro ao atualizar categoria" });
    }
  });

  // DELETE /implementacao/:id_implementacao/categoria/:id_categoria
  fastify.delete("/implementacao/:id_implementacao/categoria/:id_categoria", async (request, reply) => {
      const { id_implementacao, id_categoria } = request.params;
      console.log(`Recebido para excluir categoria: Implementação ${id_implementacao}, Categoria ${id_categoria}`);

      try {
          // 1. Verificar se a categoria existe
          const categoriaCheck = await pool.query(
              `SELECT * FROM categoria
              WHERE id_categoria = $1 AND id_implementacao = $2`,
              [id_categoria, id_implementacao]
          );

          if (categoriaCheck.rowCount === 0) {
              return reply.code(404).send({ error: "Categoria não encontrada" });
          }

          // 2. Obter categoria ".Outro"
          const outroResult = await pool.query(
              `SELECT id_categoria 
              FROM categoria
              WHERE id_implementacao = $1
                AND LOWER(nome) IN ('.outro', 'outro')`,
              [id_implementacao]
          );

          if (outroResult.rowCount === 0) {
              return reply.code(400).send({
                  error: "Categoria '.Outro' não encontrada nesta implementação"
              });
          }

          const idCategoriaOutro = outroResult.rows[0].id_categoria;

          // 3. Obter emails que têm categorização ativa na categoria a eliminar
          const emailsParaReclassificar = await pool.query(
              `SELECT id_email
              FROM email_categorizacao
              WHERE id_categoria = $1
                AND ativo = true`,
              [id_categoria]
          );

          // 4. Reclassificar emails para .Outro
          for (const row of emailsParaReclassificar.rows) {
              const idEmail = row.id_email;

              // 4.1 Desativar categorização atual
              await pool.query(
                  `UPDATE email_categorizacao
                  SET ativo = false
                  WHERE id_email = $1`,
                  [idEmail]
              );

              // 4.2 Criar nova categorização para .Outro
              await pool.query(
                  `INSERT INTO email_categorizacao
                      (id_email, id_categoria, id_tipo_categorizacao, ativo)
                  VALUES ($1, $2, 3, true)`,
                  [idEmail, idCategoriaOutro]
              );
          }

          // 5. Apagar categoria (com cascade para keywords)
          const result = await pool.query(
              `DELETE FROM categoria
              WHERE id_categoria = $1 AND id_implementacao = $2
              RETURNING *`,
              [id_categoria, id_implementacao]
          );

          return reply.send({
              message: "Categoria eliminada com sucesso e emails reclassificados para '.Outro'",
              categoria: result.rows[0],
              emails_reclassificados: emailsParaReclassificar.rowCount
          });

      } catch (err) {
          request.log.error(err);
          return reply.code(500).send({ error: "Erro ao eliminar categoria" });
      }
  });

}