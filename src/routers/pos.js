const express = require('express');
const router = express.Router();

const posController = require('../controllers/pos');

router.get('/', posController.getStat);


module.exports = router;