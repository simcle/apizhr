const express = require('express');
const router = express.Router();

const stockOpnameController = require('../controllers/stockopname');

router.get('/shop', stockOpnameController.getShop);
router.get('/draft', stockOpnameController.getDraft);
router.post('/draft', stockOpnameController.insertDraf);
router.put('/draft', stockOpnameController.updateDraft);
router.post('/confirm', stockOpnameController.confirmDraft);

module.exports = router