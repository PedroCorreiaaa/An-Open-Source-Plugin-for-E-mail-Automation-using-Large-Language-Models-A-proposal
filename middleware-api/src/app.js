import Fastify from "fastify";
import { config } from "./config.js";
import { verifySecret } from "./utils/auth.js";
import implementacaoRoutes from "./routes/implementacao.js";
import categoriaRoutes from "./routes/categoria.js";
import keywordRoutes from "./routes/keyword.js";
import fastifyCors from '@fastify/cors';
import emailRoutes from "./routes/email.js";


const fastify = Fastify({
  logger: true,
  connectionTimeout: 10000, // 10s
  bodyLimit: 1048576,
});


fastify.register(fastifyCors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-secret'],
});

// Global security hook
fastify.addHook("onRequest", verifySecret);

// Register routes
fastify.register(implementacaoRoutes);
fastify.register(categoriaRoutes);
fastify.register(keywordRoutes);
fastify.register(emailRoutes);

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  reply.code(500).send({ error: "Internal Server Error" });
});

const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: "0.0.0.0" });
    fastify.log.info(`API listening on ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
