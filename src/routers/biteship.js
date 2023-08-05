const express = require('express');
const router = express.Router();

const biteshipController = require('../controllers/biteship');

router.get('/maps', biteshipController.getMaps);
router.post('/rates', biteshipController.postRates);
router.post('/tracking', biteshipController.getTracking);

module.exports = router;