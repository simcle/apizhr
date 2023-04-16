const express = require('express');
const router = express.Router();

const categoryController = require('../controllers/category');

router.get('/', categoryController.getCategory);
router.post('/create', categoryController.postCategory);
router.put('/update/:categoryId', categoryController.putCategory);

module.exports = router;