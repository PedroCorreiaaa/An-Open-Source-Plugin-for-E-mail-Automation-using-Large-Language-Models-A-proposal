import amqp from "amqplib";
import { pool } from "../db.js";
import generateResponseFromRAG from "../services/generateResponseFromRAG.js";
import { PROCESS_RAG } from "../queue/jobTypes.js";

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";
const QUEUE_NAME = "emailTasks";

async function startWorker() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAME, { durable: true });

    console.log("Worker initialized and ready to process jobs");

    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        const jobData = JSON.parse(msg.content.toString());
        console.log(`Worker started processing job with data:`, jobData);

        if (jobData.type === PROCESS_RAG) {
          const { job_id, message_id, remetente, assunto, corpo, thread_id } = jobData;

          try {
            await pool.query(
              `UPDATE resposta_gerada SET status = 'PROCESSING' WHERE id_resposta = $1`,
              [job_id]
            );
            console.log(`Job ${job_id} status updated to 'PROCESSING'`);

            const emailContent = `Remetente: ${remetente} Assunto: ${assunto} ${corpo}`;
            const resposta = await generateResponseFromRAG(emailContent);
            console.log(`Generated response for job ${job_id}:`, resposta);

            await pool.query(
              `UPDATE resposta_gerada 
               SET status = 'DONE', conteudo = $2
               WHERE id_resposta = $1`,
              [job_id, resposta]
            );
            await pool.query(
              `UPDATE email
               SET resposta_gerada = TRUE, resposta = $2
               WHERE message_id = $1`,
              [message_id, resposta]
            );

            console.log(`Job ${job_id} completed successfully`);
            channel.ack(msg); 
          } catch (err) {
            console.error(`Error processing job ${job_id}:`, err);
            await pool.query(
              `UPDATE resposta_gerada
               SET status = 'ERROR', conteudo = $2
               WHERE id_resposta = $1`,
              [job_id, err.message]
            );
            channel.nack(msg, false, false); 
            console.log(`Job ${job_id} marked as ERROR`);
          }
        } else {
          console.log("Job type not recognized:", jobData.name);
          channel.ack(msg);
        }
      }
    }, { noAck: false });

    pool.connect()
      .then(client => {
        console.log("Database connection established successfully");
        client.release();
      })
      .catch(err => {
        console.error("Error connecting to the database:", err.message);
        console.error("Stack trace:", err.stack);
      });

  } catch (err) {
    console.error("Error initializing RabbitMQ worker:", err);
  }
}

startWorker();
