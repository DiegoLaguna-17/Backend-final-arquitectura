require('dotenv').config();
const express = require('express');
const routes = require('./routes/index');
const { connectKafka } = require('./config/kafka');

const app = express();
const port = process.env.PORT || 3002;

app.use(express.json());

// Main Routes
app.use('/', routes);

// Init service
const startServer = async () => {
  await connectKafka();
  
  
  app.listen(port, '0.0.0.0', () => {
    console.log(`integrations_service running on port ${port}`);
  });
};

startServer();
