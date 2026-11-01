const express = require('express');
const router = express.Router();

const financeController = require('../controllers/finance');

router.get('/cash-in-source', financeController.getCashInSource);
router.get('/cash-in-summary', financeController.getCashInSummary);

module.exports = router;