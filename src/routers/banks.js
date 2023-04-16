const express = require('express');
const router = express.Router();

const banksController = require('../controllers/banks');

router.get('/bank', banksController.getBank);
router.post('/bank', banksController.postBank);
router.put('/bank/:bankId', banksController.putBank);
module.exports = router;