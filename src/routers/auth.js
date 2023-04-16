const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const multer = require('multer');
const uuid = require('uuid');

// file image storage
const fileStorage =  multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/img/avatar');
    },
    filename: (req, file, cb) => {
        const ext = file.mimetype.split("/")[1];
        cb(null, `${new Date().getTime()}-${uuid.v1()}.${ext}`);
    }
});
const upload = multer({storage: fileStorage});

const authenticateToken = require('../../authenticate');

const authController = require('../controllers/auth');

// get all user
router.get('/', authenticateToken, authController.getUsers);

// for get user
router.get('/me', authenticateToken, authController.getMe);

// for register or create new user
router.post('/register',[
    body('name').notEmpty(),
    body('email').notEmpty(),
    body('password').notEmpty().isLength({min: 6})
], authController.UserRegister);

// for user login
router.post('/login',[
    body('email').notEmpty(),
    body('password').notEmpty()
], authController.UserLogin);

//for update 
router.put('/update/:userId', authenticateToken, upload.single('avatar'), [
    body('name').notEmpty(),
    body('email').notEmpty()
], authController.UserUpdate);

// for refresh token
router.post('/refresh-token', [
    body('token').notEmpty()
], authController.RefreshToken);

// for user logout 
router.delete('/logout', authController.UserLogout);

module.exports = router;


