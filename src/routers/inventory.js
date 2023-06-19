const express = require('express');
const router = express.Router();

const inventroyController = require('../controllers/inventory');

router.get('/:productId', inventroyController.getStock);

module.exports = router;