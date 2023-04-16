const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');

const router = express.Router();

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/img');
    },
    filename: (req, file, cb) => {
        const ext = file.mimetype.split("/")[1];
        cb(null, `company-logo.${ext}`);
    }
})

const upload = multer({storage: fileStorage});
const companyController = require('../controllers/company');

router.post('/upload-company-logo', upload.single('image'), companyController.uploadCompanyLogo);
router.get('/company', companyController.getCompany);
router.post('/company', [body('name').notEmpty()], companyController.postCompnay);

module.exports = router;