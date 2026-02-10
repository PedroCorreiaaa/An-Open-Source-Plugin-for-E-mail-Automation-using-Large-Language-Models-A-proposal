import jwt from "jsonwebtoken";
import rateLimit from "@fastify/rate-limit";
import { config } from "../config.js";

export default async function authRoutes(fastify) {

  await fastify.register(rateLimit, {
    max: 5,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: "Too Many Requests",
    }),
  });

  fastify.post("/auth/token", async (req, reply) => {
    const apiSecret = req.headers["x-api-secret"];

    if (!apiSecret || apiSecret !== config.apiSecret) {
      return reply.code(401).send({ error: "Invalid API secret" });
    }

    const payload = {
      iss: "email-plugin",
      scope: "plugin",
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    });

    return { token };
  });
}
