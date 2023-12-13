const express = require('express');
const router = express.Router();

const mitraController = require('../controllers/mitraController');
router.get('/dashboard', mitraController.getDashboard);
router.get('/sku', mitraController.getSKU);
router.get('/', mitraController.getSales);
router.post('/', mitraController.insertSales);
router.put('/', mitraController.deleteSales);
router.get('/inventory', mitraController.getInventory);

router.get('/so/sku', mitraController.getSoSku);
router.post('/so', mitraController.insertSoInventory);

module.exports = router