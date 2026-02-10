import jwt from "jsonwebtoken";
import { config } from "../config.js";

export async function verifyJWT(req, reply) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    reply.code(401).send({ error: "Missing Authorization header" });
    throw new Error("Unauthorized");
  }

  const [, token] = authHeader.split(" ");

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
  } catch (err) {
    reply.code(401).send({ error: "Invalid or expired token" });
    throw new Error("Unauthorized");
  }
}
