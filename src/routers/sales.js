const express = require('express');
const router = express.Router();

const salesController = require('../controllers/sales');

router.get('/', salesController.getSales);
router.get('/:salesId', salesController.getDetailSales);
router.post('/', salesController.insertSales);
router.put('/', salesController.updateSales);

module.exports = router