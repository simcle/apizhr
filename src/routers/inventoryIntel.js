const express = require('express')
const router = express.Router();

const inventroyIntelController = require('../controllers/inventoryIntel')

router.get('/summary', inventroyIntelController.getSummary)
router.get('/issues', inventroyIntelController.getIssues)
router.get('/actions', inventroyIntelController.getActions)
router.get('/product/:productId', inventroyIntelController.getProductDetail)

module.exports = router