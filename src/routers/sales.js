const express = require('express');
const router = express.Router();

const salesController = require('../controllers/sales');

router.get('/', salesController.getSales);
router.get('/:salesId', salesController.getDetailSales);
router.post('/', salesController.insertSales);
router.put('/', salesController.updateSales);
router.get('/report/download', salesController.getReport);

module.exports = router