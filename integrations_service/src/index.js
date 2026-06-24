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
  // Intentar conectar a Kafka (no bloquea si falla)
  await connectKafka();

  app.listen(port, '0.0.0.0', () => {
    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('║  NeoLend - Integrations & Gateway Service          ║');
    console.log('║  Capa Anticorrupción + Circuit Breaker             ║');
    console.log(`║  Corriendo en http://localhost:${port}               ║`);
    console.log('╚═══════════════════════════════════════════════════╝\n');
    console.log('Endpoints disponibles:');
    console.log(`  GET  http://localhost:${port}/test-db`);
    console.log(`  GET  http://localhost:${port}/api/legacy/buro?carnet=1234567`);
    console.log(`  GET  http://localhost:${port}/api/legacy/circuit-status\n`);
  });
};

startServer();
