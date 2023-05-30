const express = require('express');
const router = express.Router();

const AttlogsController = require('../controllers/attlogs');

router.get('/', AttlogsController.getAttlogs);
router.get('/stats', AttlogsController.getStats);

router.post('/', AttlogsController.updateAttlog);


module.exports = router;