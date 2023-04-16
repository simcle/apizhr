const Banks = require('../models/banks');

exports.getBank = (req, res) => {
    Banks.find()
    .then(result => {
        res.status(200).json(result);
    })
    .catch(err => {
        res.status(200).send(err)
    });
};

exports.postBank = (req , res) => {
    const bank = new Banks({
        name: req.body.name,
        accountNumber: req.body.accountNumber,
        accountName: req.body.accountName,
        kcp: req.body.kcp,
        icon: req.body.icon
    });
    bank.save()
    .then(result => {
        res.status(200).json(result);
    })
    .catch(err => {
        res.status(400).send(err);
    });
};

exports.putBank = (req, res) => {
    Banks.findById(req.params.bankId)
    .then(bank => {
        bank.name = req.body.name;
        bank.accountNumber = req.body.accountNumber;
        bank.accountName = req.body.accountName;
        bank.kcp = req.body.kcp
        bank.icon = req.body.icon
        return bank.save();
    })
    .then(result => {
        res.status(200).json(result);
    })
    .catch(err => {
        res.status(400).send(err);
    });
};