import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 4000,
  apiSecret: process.env.API_SECRET,
  dbUrl: process.env.DATABASE_URL,
};
