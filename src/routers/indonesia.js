const express = require('express');
const router = express.Router();

const indonesiaController = require('../controllers/indonesia');

router.get('/subdistricts', indonesiaController.getSubdistricts);

module.exports = router;