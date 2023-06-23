const express = require('express');
const router = express.Router();

const SupplierController = require('../controllers/supplier');

router.post('/', SupplierController.insertSupplier);
router.get('/search', SupplierController.getSupplier);

module.exports = router;