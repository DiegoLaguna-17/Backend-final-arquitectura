const { Kafka } = require('kafkajs');

const broker = process.env.KAFKA_BROKER || 'kafka:9092';

const kafka = new Kafka({
  clientId: 'neolend-client',
  brokers: [broker],
  retry: {
    initialRetryTime: 100,
    retries: 1
  }
});

const producer = kafka.producer();

const connectKafka = async () => {
  try {
    await producer.connect();
    console.log('Kafka Producer connected');
  } catch (error) {
    console.error('Error connecting to Kafka:', error.message);
  }
};

const sendMessage = async (topic, message) => {
  try {
    await producer.send({
      topic,
      messages: [
        { value: JSON.stringify(message) }
      ],
    });
    console.log(`Message sent to topic ${topic}`);
  } catch (error) {
    console.error(`Failed to send message to topic ${topic}:`, error.message);
  }
};

// Expose consumer directly if needed for specific subscriptions
const createConsumer = (groupId) => kafka.consumer({ groupId });

module.exports = {
  kafka,
  connectKafka,
  sendMessage,
  createConsumer
};
