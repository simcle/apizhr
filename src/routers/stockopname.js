const express = require('express');
const router = express.Router();

const stockOpnameController = require('../controllers/stockopname');

// DEKSTOP
router.get('/', stockOpnameController.getStockOpname);
router.get('/detail/:id', stockOpnameController.getDetail);
router.put('/validate/:id', stockOpnameController.validateStockOpname);

// MOBILE
router.get('/shop', stockOpnameController.getShop);
router.get('/draft', stockOpnameController.getDraft);
router.post('/draft', stockOpnameController.insertDraf);
router.put('/draft', stockOpnameController.updateDraft);
router.post('/confirm', stockOpnameController.confirmDraft);

module.exports = router