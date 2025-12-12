import pkg from "pg";
import { config } from "./config.js";

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: config.dbUrl,
  max: 10,
  idleTimeoutMillis: 10000,
});

pool.connect()
  .then(client => {
    console.log("DB Connected");
    client.release();
  })
  .catch(err => console.error("Error connecting to DB", err.message));
