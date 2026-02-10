import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 4000,
  dbUrl: process.env.DATABASE_URL,
  ragDbUrl: process.env.PGVECTOR_URL,
  apiSecret: process.env.API_SECRET,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: '1h',

};
