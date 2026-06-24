const express = require('express');
const router = express.Router();

const testController = require('../controllers/testController');
const buroController = require('../controllers/buroController');

// Health check / test de BD
router.get('/test-db', testController.testDb);

// -------------------------------------------------------
// Integrations & Gateway Service - Capa Anticorrupción
// -------------------------------------------------------

// Consultar buró de crédito IBM Z con Circuit Breaker
// GET /api/legacy/buro?carnet=1234567
router.get('/api/legacy/buro', buroController.consultarBuro);

// Ver estado actual del Circuit Breaker + logs
// GET /api/legacy/circuit-status
router.get('/api/legacy/circuit-status', buroController.estadoCircuito);

module.exports = router;
