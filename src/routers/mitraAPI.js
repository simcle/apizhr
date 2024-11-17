const express = require('express');
const router = express.Router();

const mitraController = require('../controllers/mitraController');
router.get('/dashboard', mitraController.getDashboard);
router.get('/sku', mitraController.getSKU);
router.get('/', mitraController.getSales);
router.post('/', mitraController.insertSales);
router.put('/', mitraController.deleteSales);
router.get('/inventory', mitraController.getInventory);
router.get('/shops', mitraController.getShop);
router.get('/stock', mitraController.getStockBarang);
router.post('/transfer', mitraController.transferStok);
router.get('/transfer', mitraController.getTransfer);

router.get('/so/sku', mitraController.getSoSku);
router.post('/so', mitraController.insertSoInventory);
router.get('/so/download', mitraController.getSo)

module.exports = router