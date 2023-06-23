const express = require('express');
const router = express.Router();

const inventroyController = require('../controllers/inventory');

router.get('/:productId', inventroyController.getStock);
router.get('/stock/barang', inventroyController.getStockBarang);

module.exports = router;