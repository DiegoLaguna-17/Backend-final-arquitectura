const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

router.get('/test-db', testController.testDb);

module.exports = router;