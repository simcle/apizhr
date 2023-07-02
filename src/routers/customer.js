const express = require('express');
const router = express.Router();

const customerController = require('../controllers/customer');

router.get('/', customerController.getAllCustomer);
router.get('/search', customerController.searchCustomer);
router.get('/dropship', customerController.searchDropshipper);
router.post('/', customerController.insertCustomer);
router.post('/dropship', customerController.insertDropshipper);

module.exports = router;