const Category = require('../models/categories');

exports.getCategory = (req, res) => {
    const search = req.query.search;
    const currentPage = req.query.page || 1;
    const perPage = req.query.perPage || 20;
    let totalItems;
    Category.find({name: {$regex: '.*'+search+'.*', $options: 'i'}})
    .countDocuments()
    .then(count => {
        totalItems = count
        return Category.find({name: {$regex: '.*'+search+'.*', $options: 'i'}})
        .skip((currentPage-1) * perPage)
        .limit(perPage)
        .sort({createdAt: 'desc'});
    })
    .then(result => {
        const last_page = Math.ceil(totalItems / perPage)
        res.status(200).json({
            data: result,
            pages: {
                current_page: currentPage,
                last_page: last_page
            }
        })
    })
    .catch(err => {
        res.status(400).send(err);
    });
};

exports.postCategory = (req, res) => {
    const category = new Category({
        name: req.body.name,
        description: req.body.description
    })
    category.save()
    .then(result => {
        res.status(200).json(result);
    })
    .catch(err => {
        res.status(400).send(err);
    });
};

exports.putCategory = (req, res) => {
    Category.findById(req.params.categoryId)
    .then(category => {
        category.name = req.body.name,
        category.description = req.body.description
        return category.save()
    })
    .then(result => {
        res.status(200).json(result);
    })
    .catch(err => {
        res.status(400).send(err);
    });
};