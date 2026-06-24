const { Kafka } = require('kafkajs');

const broker = process.env.KAFKA_BROKER || 'kafka:9092';

const kafka = new Kafka({
  clientId: 'neolend-integrations',
  brokers: [broker]
});

const producer = kafka.producer();

const connectKafka = async () => {
  try {
    await producer.connect();
    console.log('[Kafka] Producer conectado correctamente');
  } catch (error) {
    console.warn('[Kafka] No se pudo conectar al broker. Continuando sin Kafka:', error.message);
  }
};

const sendMessage = async (topic, message) => {
  try {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }]
    });
    console.log(`[Kafka] ✅ Mensaje enviado al topic "${topic}"`);
  } catch (error) {
    console.warn(`[Kafka] ⚠️  No se pudo enviar mensaje al topic "${topic}":`, error.message);
  }
};

const createConsumer = (groupId) => kafka.consumer({ groupId });

module.exports = { kafka, connectKafka, sendMessage, createConsumer };
