const express = require('express')
const router = express.Router()

const employeeController = require('../controllers/employee')
const authenticate = require('../../authenticate')
const authorize = require('../middleware/authorize')

router.get('/', employeeController.getAllemployee)

router.get(
    '/invite',
    authenticate,
    authorize('admin', 'supervisor'),
    employeeController.inviteEmployee
)

router.post(
    '/invite',
    employeeController.sendInvite
)

router.put(
    '/:id/activate-access',
    authenticate,
    authorize('admin', 'supervisor'),
    employeeController.activateAccess
)

router.get('/detail/:id', employeeController.getDetailEmployee)
router.get('/create', employeeController.createEmployee)
router.post('/create', employeeController.insertEmployee)
router.put('/update/:id', employeeController.updateEmployee)
router.post('/fingerprint', employeeController.fingerPrint)
router.post('/resign', employeeController.resignEmployee)
router.post('/active', employeeController.activeEmployee)
router.put('/transfer', employeeController.employeeTransfer)

module.exports = router