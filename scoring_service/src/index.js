require('dotenv').config();
const express = require('express');
const routes = require('./routes/index');
const { connectKafka } = require('./config/kafka');

const app = express();
const port = process.env.PORT || 3003;

app.use(express.json());

// Main Routes
app.use('/', routes);

// Init service
const startServer = async () => {
  await connectKafka();
  
  const { createConsumer } = require('./config/kafka');
  const consumer = createConsumer('scoring-group');
  await consumer.connect();
  await consumer.subscribe({ topic: 'user_created', fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log('Received user_created event to calculate initial score', message.value.toString());
    },
  });

  
  app.listen(port, '0.0.0.0', () => {
    console.log(`scoring_service running on port ${port}`);
  });
};

startServer();
