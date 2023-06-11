const stockCards = require('../models/stockCard');

module.exports = async (event, shopId, productId, documentId, documentName, qty, balance) => {
    switch(event) {
        case 'in':
            const stockin = new stockCards({
                shopId: shopId,
                productId: productId,
                documentId: documentId,
                documentName: documentName,
                stockIn: qty,
                balance: balance,
            })
            await stockin.save()
            break;
        case 'out':
            const stockout = new stockCards({
                shopId: shopId,
                productId: productId,
                documentId: documentId,
                documentName: documentName,
                stockOut: qty,
                balance: balance,
            })
            await stockout.save()
            break;
    }
}