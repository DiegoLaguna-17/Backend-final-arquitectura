const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');
const {registrarUsuario}=require('../controllers/onboarding.controller')
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });
router.get('/test-db', testController.testDb);

router.post('/registrar', upload.fields([
    { name: 'imagen_doc', maxCount: 1 }, 
    { name: 'imagen_selfie', maxCount: 1 }
]), registrarUsuario);

module.exports = router;