const express = require('express');
const router = express.Router();

const onlineController = require('../controllers/online');

router.get('/dashboard', onlineController.getDashboard);
router.get('/stats', onlineController.getSales);
router.get('/create', onlineController.createSale);
router.get('/edit/:onlineId', onlineController.editSale);
router.post('/', onlineController.insertSales);
router.put('/:onlineId', onlineController.updateSale);
router.post('/dropship', onlineController.insertDropship);
router.get('/dropship/:onlineId', onlineController.editDropship);
router.put('/dropship/:onlineId', onlineController.updateDropship);
router.put('/printed/:onlineId', onlineController.updatePrinted);
router.put('/resi/:onlineId', onlineController.updateResi);
router.get('/transfer', onlineController.getTransfer);
router.get('/statistics', onlineController.statistics);
router.get('/exports', onlineController.downloadExcel);

module.exports = router;