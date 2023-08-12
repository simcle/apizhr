const express = require('express');
const router = express.Router();

const payrollController = require('../controllers/payroll');

router.get('/', payrollController.getPayroll);

module.exports = router