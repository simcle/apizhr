const MitraInventoryModel = require('../models/mitraInventory');

module.exports = async (type, mitraId, item) => {
    MitraInventoryModel.findOne({$and: [{mitraId: mitraId}, {productId: item.productId}]})
    .then( async (inventory) => {
        if(inventory) {
            if(type == 'receipt') {
                inventory.qty = inventory.qty + item.qty
                inventory.name = item.name,
                inventory.unitPrice = item.price,
                await inventory.save()
            }
            if(type == 'return') {
                inventory.qty = inventory.qty - item.qty
                inventory.name = item.name,
                await inventory.save()
            }
            if(type == 'sales') {
                inventory.qty = inventory.qty - item.qty
                await inventory.save()
            }
        } else {
            if(type == 'return') {
                const newInventory = new MitraInventoryModel({
                    mitraId: mitraId,
                    productId: item.productId,
                    sku: item.sku,
                    name: item.name,
                    unitPrice: item.price,
                    qty: 0
                })
                await newInventory.save()
            } else {
                const newInventory = new MitraInventoryModel({
                    mitraId: mitraId,
                    productId: item.productId,
                    sku: item.sku,
                    name: item.name,
                    unitPrice: item.price,
                    qty: item.qty
                })
                await newInventory.save()
            }
        }
    })

}