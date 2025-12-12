import { config } from "../config.js";

export const verifySecret = async (req, reply) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    reply.code(401).send({ error: "Missing Authorization header" });
    throw new Error("Unauthorized");
  }

  const token = authHeader.split(" ")[1];
  if (token !== config.apiSecret) {
    reply.code(401).send({ error: "Invalid API secret" });
    throw new Error("Unauthorized");
  }
};
