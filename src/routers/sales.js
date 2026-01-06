const express = require('express');
const router = express.Router();

const salesController = require('../controllers/sales');

router.get('/', salesController.getSales);
router.get('/:salesId', salesController.getDetailSales);
router.post('/draft', salesController.insertDraft);
router.get('/data/draft', salesController.getDraft);
router.delete('/draft/:id', salesController.deleteDraft);
router.post('/', salesController.insertSales);
router.put('/', salesController.updateSales);
router.get('/report/best', salesController.getBestSales);
router.get('/report/download', salesController.getReport);
router.get('/report/outlet', salesController.getOutlet)
router.get('/report/statistics', salesController.getChart)
router.get('/report/filter', salesController.getSalesFilter)
module.exports = router