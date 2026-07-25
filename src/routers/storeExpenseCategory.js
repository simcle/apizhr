const express = require('express')
const router = express.Router()

const storeExpenseCategoryController = require('../controllers/storeExpenseCategory')

router.get('/', storeExpenseCategoryController.getAll)

router.get('/active', storeExpenseCategoryController.getActive)

router.get('/:id', storeExpenseCategoryController.getById)

router.post('/', storeExpenseCategoryController.create)

router.put('/:id', storeExpenseCategoryController.update)

router.delete('/:id', storeExpenseCategoryController.remove)

module.exports = router


// GET    /api/store-expense-categories
// GET    /api/store-expense-categories/active
// GET    /api/store-expense-categories/:id
// POST   /api/store-expense-categories
// PUT    /api/store-expense-categories/:id
// DELETE /api/store-expense-categories/:id