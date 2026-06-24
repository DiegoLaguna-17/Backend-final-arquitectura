require('dotenv').config();
const express = require('express');
const routes = require('./routes/index');
const { connectKafka } = require('./config/kafka');

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/', routes);

// Init service
const startServer = async () => {
  await connectKafka();
  
  
  app.listen(port, '0.0.0.0', () => {
    console.log(`onboarding_service running on port ${port}`);
  });
};

startServer();
