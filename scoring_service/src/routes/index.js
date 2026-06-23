const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

router.get('/test-db', testController.testDb);

const scoringController = require('../controllers/scoringController');
router.post('/score', scoringController.score);

module.exports = router;