const express = require('express');
const router = express.Router();

const mitraController = require('../controllers/mitraController');

router.get('/sku', mitraController.getSKU);
router.get('/', mitraController.getSales);
router.post('/', mitraController.insertSales);
router.put('/', mitraController.deleteSales);
router.get('/inventory', mitraController.getInventory);

module.exports = router