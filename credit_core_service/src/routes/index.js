const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');
const creditRoutes = require('./creditRoutes');

router.get('/test-db', testController.testDb);

// Mount credit core routes
router.use('/api/creditos', creditRoutes);
router.use('/creditos', creditRoutes);

module.exports = router;