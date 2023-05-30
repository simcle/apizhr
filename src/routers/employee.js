const express = require('express');
const router = express.Router();

const employeeController = require('../controllers/employee');

router.get('/', employeeController.getAllemployee);
router.get('/invite', employeeController.inviteEmployee);
router.post('/invite', employeeController.sendInvite);
router.get('/detail/:id', employeeController.getDetailEmployee);
router.get('/create', employeeController.createEmployee);
router.post('/create', employeeController.insertEmployee);
router.put('/update/:id', employeeController.updateEmployee);
router.post('/fingerprint', employeeController.fingerPrint);
router.post('/resign', employeeController.resignEmployee);
router.post('/active', employeeController.activeEmployee);

module.exports = router;