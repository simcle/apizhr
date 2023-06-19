const express = require('express');
const router = express.Router();

const stockCardController = require('../controllers/stockCard');

router.get('/:productId', stockCardController.getStockCard);

module.exports = router;
