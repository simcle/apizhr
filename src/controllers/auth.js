require('dotenv').config();
const {validationResult} = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const User = require('../models/users');
const Shops = require('../models/shops')
const tokenExpired = '1d'

// get All User
exports.getUsers = (req, res) => {
    const shops = Shops.find().lean()
    const users = User.aggregate([
        {$lookup: {
            from: 'shops',
            localField: 'shopId',
            foreignField: '_id',
            as: 'shop'
        }},
        {$unwind: {
            path: '$shop',
            preserveNullAndEmptyArrays: true
        }},
        {$addFields: {
            shop: '$shop.name'
        }},
        {$project: {
            name: 1,
            email: 1,
            role: 1,
            shop: 1,
            shopId: 1
        }}
        
    ])
    Promise.all([
        shops,
        users
    ])
    .then(result => {
        res.status(200).json({
            shops: result[0].map(obj => {
                obj.id = obj._id,
                obj.text = obj.name
                return obj
            }),
            users: result[1]
        })
    })
    .catch(err => {
        res.status(400).send(err)
    })
}

// get user 
exports.getMe = (req, res) => {
    const userId = req.user._id
    User.findById(userId).select('name email role')
    .then(result => {
        res.status(200).json(result)
    })
}

// register
exports.UserRegister = async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json(errors.array());
    };

    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const shopId = req.body.shopId
    const role = req.body.role
    
    const hashPassword = await bcrypt.hash(password, 10);
    if(shopId) {
        const register = new User({
            name: name,
            email: email,
            shopId: shopId,
            password: hashPassword,
            role: role
        })
        register.save()
        .then(() => {
            res.status(201).send('Success');
        })
        .catch(err => {
            res.status(400).send(err);
        });
    } else {
        const register = new User({
            name: name,
            email: email,
            password: hashPassword,
            role: role
        })
        register.save()
        .then(() => {
            res.status(201).send('Success');
        })
        .catch(err => {
            res.status(400).send(err);
        });
    }
};

// user login
exports.UserLogin = (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json(errors.array());
    };
    
    const email = req.body.email;
    const password = req.body.password;

    User.findOne({email: email})
    .then(result => {
        if(!result) {
            return res.status(400).send('Email not found');
        }
        (async () => {
            try {
                if( await bcrypt.compare(password, result.password)) {
                    const user = {_id: result._id}
                    const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: tokenExpired})
                    const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET)
                    const data = {
                        id: result._id,
                        name: result.name,
                        email: result.email,
                        role: result.role,
                        avatar: result.avatar,
                    }
                    result.refreshToken = refreshToken
                    result.save();

                    res.status(200).json({accessToken: accessToken, refreshToken: refreshToken, user: data});
                } else {
                    res.status(400).send('Wrong password');
                }
            } catch (error) {
                res.status(400).send()
            }
        })();
    });
};

// user update
exports.UserUpdate = (req, res) => {
    const errors = validationResult(req)

    if(!errors.isEmpty()) {
        return res.status(400).json(errors.array());
    }

    const userId = req.params.userId;
    User.findById(userId)
    .then(user => {
        if (!user) {
            return res.status(400).send('User not found');
        }
        if(req.file) {
            if(user.avatar) {
                removeImage(user.avatar);
            }
            user.name = req.body.name;
            user.email = req.body.email;
            user.shopId = req.body.shopId
            user.avatar = req.file.path;
        } else {
            user.name = req.body.name;
            user.email = req.body.email;
            user.shopId = req.body.shopId
            user.role = req.body.role
        }
        return user.save();
    })
    .then(result => {
        const data = {
            id: result._id,
            name: result.name,
            email: result.email,
            shopId: result.shopId,
            avatar: result.avatar,
        }
      res.status(200).json({message: 'Update successfully', data: data})  
    })
    .catch(err => {
        res.status(400).send(err);
    })
};

// refresh token
exports.RefreshToken = (req, res) => {
    const refreshToken = req.body.token;
    if(refreshToken == null ) return res.status(401).send('token not found');
    User.findOne({refreshToken: refreshToken})
    .then(result => {
        if (!result) return res.sendStatus(403);
        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
            if(err) return res.sendStatus(403);
            const accessToken = jwt.sign({_id: user._id}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: tokenExpired});
            res.json({accessToken: accessToken});
        })
    })
    .catch(err => {
        return res.status(400).send(err);
    })
}

// user logout
exports.UserLogout = (req, res) => {
    User.findOne({refreshToken: req.body.token})
    .then(result => {
        result.refreshToken = '';
        result.save()
        res.sendStatus(204);
    })
    .catch (err => {
        res.status(400).send(err);
    })
}

// remove image from storage
const removeImage = (filePath) => {
    filePath = path.join(__dirname, '../..', filePath);
    fs.unlink(filePath, err => {
       if(err) return;
    })
}