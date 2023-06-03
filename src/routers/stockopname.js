const express = require('express');
const router = express.Router();

const stockOpnameController = require('../controllers/stockopname');

router.get('/shop', stockOpnameController.getShop);


module.exports = router