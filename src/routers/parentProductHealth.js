const express = require('express')

const router = express.Router()

const controller = require('../controllers/parentProductHealth')

router.get('/', controller.getParents )

router.get('/:parentId', controller.getParentDetail )

module.exports = router