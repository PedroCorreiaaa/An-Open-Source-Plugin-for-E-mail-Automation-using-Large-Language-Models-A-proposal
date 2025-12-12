import amqp from "amqplib";

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";
const QUEUE_NAME = "emailTasks";

async function createQueue() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, {
    durable: true, 
  });

  return { connection, channel };
}

async function addJob(data) {
  const { channel } = await createQueue();
  channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(data)), {
    persistent: true,
  });
  console.log("Job adicionado à queue:", data);
}

export { createQueue, addJob, QUEUE_NAME };
