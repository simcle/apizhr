const express = require('express');
const router = express.Router();

const statisticsController = require('../controllers/statistics');

router.get('/', statisticsController.getStats);
router.get('/items', statisticsController.getStatItems);

module.exports = router;