const express = require('express');
const router = express.Router();
const creditController = require('../controllers/creditController');

// Commands
router.post('/solicitar', creditController.solicitarCredito);

// Queries & Audit
router.get('/historial/:credit_id', creditController.obtenerHistorial);
router.get('/verificar/:event_id', creditController.verificarEvento);
router.get('/public-key', creditController.obtenerLlavePublica);

module.exports = router;
