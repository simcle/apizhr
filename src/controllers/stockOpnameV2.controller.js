const mongoose = require('mongoose')

const StockOpname = require('../models/StockOpname')
const StockOpnameItem = require('../models/StockOpnameItem')
const Inventory = require('../models/inventory')

const Product = require('../models/products')
const StockCard = require('../models/stockCard')

async function generateNumber() {

    const now = new Date()

    const dd = String(now.getDate()).padStart(2, '0')
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const yy = String(now.getFullYear()).slice(-2)

    const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0, 0, 0, 0
    )

    const endOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23, 59, 59, 999
    )

    const last = await StockOpname
    .findOne({
        stockOpnameNumber: {
            $regex: `ZHR/STOCK/${yy}/`
        },
        validated: {
            $gte: startOfDay,
            $lte: endOfDay
        }
    })
    .sort({
        validated: -1
    })
    .select('stockOpnameNumber')

    let running = 1

    if (last) {

        const arr = last.stockOpnameNumber.split('/')

        running = Number(arr[arr.length - 1]) + 1

    }

    return `${dd}${mm}/ZHR/STOCK/${yy}/${running}`

}

/**
 * CREATE SESSION
 */
exports.createSession = async (req, res) => {
  try {

    const {
      shopId,
      opnameType,
      remarks
    } = req.body

    if (!shopId) {
      return res.status(400).json({
        message: 'shopId wajib diisi'
      })
    }

    /**
     * Default FULL
     */
    const type = opnameType || 'FULL'
    
    /**
     * Khusus FULL tidak boleh ada session aktif
     * pada shop yang sama.
     */
    if (type === 'FULL') {

      const activeSession = await StockOpname.findOne({
        shopId,
        opnameType: 'FULL',
        status: {
          $in: [
            'DRAFT',
            'COUNTING',
          ]
        }
      })

      if (activeSession) {
        return res.status(400).json({
          message: `Stock Opname FULL masih berjalan (${activeSession.stockOpnameNumber})`
        })
      }

    }
    
    const doc = await StockOpname.create({
      stockOpnameNumber: await generateNumber(),
      shopId,
      opnameType: type,
      remarks: remarks || 'Stock Opname',
      userId: req.body.userId
    })

    res.status(201).json(doc)

  } catch (err) {
    res.status(500).json({
      message: err.message
    })

  }
}

/**
 * LIST SESSION
 */
exports.getSessions = async (req, res) => {
  try {

    const page =
      Number(req.query.page || 1)

    const limit =
      Number(req.query.limit || 20)

    const skip =
      (page - 1) * limit

    const query = {}

    if (req.query.status) {
      query.status = req.query.status
    }

    if (req.query.shopId) {
      query.shopId =
        new mongoose.Types.ObjectId(
          req.query.shopId
        )
    }
    if(req.query.opnameType) {
      query.opnameType = req.query.opnameType
    }
    if (req.query.search) {

      query.stockOpnameNumber = {
        $regex: req.query.search,
        $options: 'i'
      }

    }

    const total =
      await StockOpname.countDocuments(
        query
      )

    const data =
      await StockOpname
        .find(query)
        .populate(
          'shopId',
          'name type'
        )
        .populate(
          'userId',
          'name'
        )
        .populate(
          'approvedBy',
          'name'
        )
        .populate(
          'postedBy',
          'name'
        )
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(limit)
        .lean()

    res.status(200).json({

      total,

      page,

      limit,

      totalPages:
        Math.ceil(
          total / limit
        ),

      data

    })

  } catch (err) {

    res.status(500).json({
      message: err.message
    })

  }
}

/**
 * DETAIL SESSION
 */
exports.getDetail = async (req, res) => {
  try {

    const data =
      await StockOpname
        .findById(req.params.id)

        .populate(
          'shopId',
          'name type'
        )

        .populate(
          'userId',
          'name'
        )

        .populate(
          'reviewedBy',
          'name'
        )

        .populate(
          'approvedBy',
          'name'
        )

        .populate(
          'postedBy',
          'name'
        )

        .lean()

    if (!data) {

      return res.status(404).json({
        message:
          'Stock opname tidak ditemukan'
      })

    }

    res.status(200).json(data)

  } catch (err) {

    res.status(500).json({
      message: err.message
    })

  }
}


exports.generateItems = async (req, res) => {
  try {
    const stockOpnameId = req.params.id

    const session = await StockOpname.findById(stockOpnameId)

    if (!session) {
      return res.status(404).json({
        status: false,
        message: 'Stock opname tidak ditemukan'
      })
    }

    if (session.status !== 'DRAFT') {
      return res.status(400).json({
        status: false,
        message: 'Generate item hanya bisa dilakukan saat status DRAFT'
      })
    }

    if (session.opnameType === 'RANDOM') {
      return res.status(400).json({
        status: false,
        message: 'Opname RANDOM tidak perlu generate item'
      })
    }

    const existingItem = await StockOpnameItem.findOne({
      stockOpnameId: session._id
    }).select('_id')

    if (existingItem) {
      return res.status(400).json({
        status: false,
        message: 'Item stock opname sudah pernah digenerate'
      })
    }

    const match = {
      shopId: new mongoose.Types.ObjectId(session.shopId)
    }

    const pipeline = [
      { $match: match },

      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },

      { $unwind: '$product' },

      {
        $addFields: {
          parentGroupId: {
            $ifNull: [
              '$product.parentId',
              '$product._id'
            ]
          }
        }
      }
    ]

    if (session.opnameType === 'PARENT') {
      if (!session.parentId) {
        return res.status(400).json({
          status: false,
          message: 'parentId wajib diisi untuk opnameType PARENT'
        })
      }

      pipeline.push({
        $match: {
          parentGroupId: new mongoose.Types.ObjectId(session.parentId)
        }
      })
    }

    pipeline.push(
      {
        $lookup: {
          from: 'products',
          localField: 'parentGroupId',
          foreignField: '_id',
          as: 'parent'
        }
      },

      {
        $unwind: {
          path: '$parent',
          preserveNullAndEmptyArrays: true
        }
      },

      {
        $lookup: {
          from: 'categories',
          localField: 'product.categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },

      {
        $unwind: {
          path: '$category',
          preserveNullAndEmptyArrays: true
        }
      },

      {
        $project: {
          shopId: 1,
          productId: 1,

          sku: '$product.sku',
          name: '$product.name',

          parentId: '$parentGroupId',
          parentName: {
            $ifNull: [
              '$parent.name',
              '$product.name'
            ]
          },

          categoryId: '$product.categoryId',
          categoryName: '$category.name',

          systemQtySnapshot: '$qty',

          unitCost: {
            $ifNull: [
              '$product.purchase',
              {
                $ifNull: [
                  '$product.price',
                  0
                ]
              }
            ]
          }
        }
      },

      {
        $sort: {
          categoryName: 1,
          parentName: 1,
          name: 1,
          sku: 1
        }
      }
    )

    const rows = await Inventory.aggregate(pipeline).allowDiskUse(true)

    if (!rows.length) {
      return res.status(400).json({
        status: false,
        message: 'Tidak ada inventory yang bisa digenerate untuk session ini'
      })
    }

    const now = new Date()

    const ops = rows.map(row => ({
      updateOne: {
        filter: {
          stockOpnameId: session._id,
          productId: row.productId
        },
        update: {
          $setOnInsert: {
            stockOpnameId: session._id,
            shopId: session.shopId,

            productId: row.productId,

            sku: row.sku,
            name: row.name,

            parentId: row.parentId || null,
            parentName: row.parentName || null,

            categoryId: row.categoryId || null,
            categoryName: row.categoryName || null,

            systemQtySnapshot: Number(row.systemQtySnapshot) || 0,

            countedQty: null,
            differenceQty: 0,

            unitCost: row.unitCost || 0,
            differenceValue: 0,

            countStatus: 'NOT_COUNTED',

            note: '',
            countedAt: null,
            countedBy: null,

            lastUpdatedAt: null,
            lastUpdatedBy: null,

            sortKey: [
              row.categoryName || '',
              row.parentName || '',
              row.name || '',
              row.sku || ''
            ].join('|')
          }
        },
        upsert: true
      }
    }))

    await StockOpnameItem.bulkWrite(ops, {
      ordered: false
    })

    const totalSystemQty = rows.reduce((sum, row) => {
      return sum + (row.systemQtySnapshot || 0)
    }, 0)

    await StockOpname.findByIdAndUpdate(session._id, {
      status: 'COUNTING',
      startedAt: now,
      snapshotAt: now,
      totalItems: rows.length,
      countedItems: 0,
      recheckItems: 0,
      differenceItems: 0,
      totalSystemQty,
      totalCountedQty: 0,
      totalPlusQty: 0,
      totalMinusQty: 0,
      totalDifferenceValue: 0
    })

    res.json({
      status: true,
      message: 'Generate item berhasil',
      stockOpnameId: session._id,
      totalItems: rows.length,
      totalSystemQty
    })

  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}

exports.getItems = async (req, res) => {
  try {
    const stockOpnameId = req.params.id

    const page = Math.max(Number(req.query.page || 1), 1)
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 500)
    const skip = (page - 1) * limit

    const match = {
      stockOpnameId: new mongoose.Types.ObjectId(stockOpnameId)
    }

    if (req.query.search) {
      match.$or = [
        {
          sku: {
            $regex: req.query.search,
            $options: 'i'
          }
        },
        {
          name: {
            $regex: req.query.search,
            $options: 'i'
          }
        },
        {
          parentName: {
            $regex: req.query.search,
            $options: 'i'
          }
        }
      ]
    }

    if (req.query.categoryId) {
      match.categoryId = new mongoose.Types.ObjectId(req.query.categoryId)
    }

    if (req.query.parentId) {
      match.parentId = new mongoose.Types.ObjectId(req.query.parentId)
    }

    if (req.query.countStatus) {
      match.countStatus = req.query.countStatus
    }

    if (req.query.onlyDifference === 'true') {
      match.differenceQty = {
        $ne: 0
      }
    }

    const summaryMatch = {
      stockOpnameId: new mongoose.Types.ObjectId(stockOpnameId)
    }

    const [summaryRows, total, data] = await Promise.all([
      StockOpnameItem.aggregate([
        { $match: summaryMatch },
        {
          $group: {
            _id: null,

            totalItems: {
              $sum: 1
            },

            countedItems: {
              $sum: {
                $cond: [
                  { $eq: ['$countStatus', 'COUNTED'] },
                  1,
                  0
                ]
              }
            },

            notCountedItems: {
              $sum: {
                $cond: [
                  { $eq: ['$countStatus', 'NOT_COUNTED'] },
                  1,
                  0
                ]
              }
            },
            postedItems: {
              $sum: {
                $cond: [
                  { $eq: ['$countStatus', 'POSTED'] },
                  1,
                  0
                ]
              }
            },

            recheckItems: {
              $sum: {
                $cond: [
                  { $eq: ['$countStatus', 'RECHECK'] },
                  1,
                  0
                ]
              }
            },

            differenceItems: {
              $sum: {
                $cond: [
                  { $ne: ['$differenceQty', 0] },
                  1,
                  0
                ]
              }
            },

            totalSystemQty: {
              $sum: '$systemQtySnapshot'
            },

            totalCountedQty: {
              $sum: {
                $ifNull: ['$countedQty', 0]
              }
            },

            totalPlusQty: {
              $sum: {
                $cond: [
                  { $gt: ['$differenceQty', 0] },
                  '$differenceQty',
                  0
                ]
              }
            },

            totalMinusQty: {
              $sum: {
                $cond: [
                  { $lt: ['$differenceQty', 0] },
                  '$differenceQty',
                  0
                ]
              }
            },

            totalDifferenceValue: {
              $sum: '$differenceValue'
            }
          }
        }
      ]),

      StockOpnameItem.countDocuments(match),

      StockOpnameItem.find(match)
        .sort({
          categoryName: 1,
          parentName: 1,
          name: 1,
          sku: 1
        })
        .skip(skip)
        .limit(limit)
        .lean()
    ])

    const summary = summaryRows[0] || {
      totalItems: 0,
      countedItems: 0,
      notCountedItems: 0,
      postedItems: 0,
      recheckItems: 0,
      differenceItems: 0,
      totalSystemQty: 0,
      totalCountedQty: 0,
      totalPlusQty: 0,
      totalMinusQty: 0,
      totalDifferenceValue: 0
    }

    res.json({
      status: true,
      stockOpnameId,
      summary,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data
    })
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}

exports.getMobileSummary = async (req, res) => {
  try {

    const shopId = req.user.shopId

    const session = await StockOpname
      .findOne({
        shopId,
        status: 'COUNTING'
      })
      .populate('shopId', 'name')
      .lean()

    if (!session) {
      return res.status(404).json({
        status: false,
        message: 'Tidak ada stock opname aktif'
      })
    }

    const progress =
      session.totalItems > 0
        ? Number(
            (
              session.countedItems /
              session.totalItems
            ) * 100
          ).toFixed(2)
        : 0

    res.json({
      status: true,
      data: {
        stockOpnameId: session._id,
        stockOpnameNumber:
          session.stockOpnameNumber,
        shop: session.shopId,
        opnameType:
          session.opnameType,
        status:
          session.status,
        snapshotAt:
          session.snapshotAt,
        startedAt:
          session.startedAt,
        totalItems:
          session.totalItems,
        countedItems:
          session.countedItems,
        notCountedItems:
          session.totalItems -
          session.countedItems,
        differenceItems:
          session.differenceItems,
        totalSystemQty:
          session.totalSystemQty,
        totalCountedQty:
          session.totalCountedQty,
        totalPlusQty:
          session.totalPlusQty,
        totalMinusQty:
          session.totalMinusQty,
        totalDifferenceValue:
          session.totalDifferenceValue,
        progress
      }
    })

  } catch (err) {

    res.status(500).json({
      status: false,
      message: err.message
    })

  }
}

exports.scanItem = async (req, res) => {
  try {

    const {
      stockOpnameId,
      sku
    } = req.body
    const shopId = req.user.shopId
    
    if (!stockOpnameId) {
      return res.status(400).json({
        status: false,
        message: 'stockOpnameId wajib diisi'
      })
    }

    if (!sku) {
      return res.status(400).json({
        status: false,
        message: 'SKU wajib diisi'
      })
    }

    const session = await StockOpname.findById(stockOpnameId)
    
    
    if (!session) {
      return res.status(404).json({
        status: false,
        message: 'Session tidak ditemukan'
      })
    }

    if (session.status !== 'COUNTING') {
      return res.status(400).json({
        status: false,
        message: 'Session belum masuk COUNTING'
      })
    }

    const barcode = sku.trim().toUpperCase()
    
    const item = await StockOpnameItem.findOne({
      stockOpnameId,
      sku: barcode
    }).lean()
    
    
    if (item) {
      const inv = await Inventory.findOne({
        shopId,
        productId: item.productId
      }).lean()
      
      return res.json({
        status: true,
        found: true,
        reason: 'FOUND',
        alreadyCounted:
          item.countStatus !== 'NOT_COUNTED',
        item,
        inv
      })
    }

    const product = await Product.findOne({
      sku: barcode,
      isActive: true
    }).select('_id')

    if (product) {

      return res.status(404).json({
        status: false,
        found: false,
        reason: 'NOT_IN_SESSION',
        message:
          'Barang bukan bagian dari Stock Opname.'
      })
    }

    return res.status(404).json({
      status: false,
      found: false,
      reason: 'NOT_FOUND',
      message:
        'SKU tidak ditemukan.'
    })

  } catch (err) {

    res.status(500).json({
      status: false,
      message: err.message
    })
  }
}

exports.updateCounted = async (req, res) => {
  const session = await mongoose.startSession()

  try {
    const itemId = req.params.id
    const countedQty = Number(req.body.countedQty)

    if (Number.isNaN(countedQty) || countedQty < 0) {
      return res.status(400).json({
        status: false,
        message: 'countedQty tidak valid'
      })
    }

    session.startTransaction()

    const oldItem = await StockOpnameItem.findById(itemId).session(session)

    if (!oldItem) {
      throw new Error('Item stock opname tidak ditemukan')
    }

    const header = await StockOpname.findById(oldItem.stockOpnameId).session(session)

    if (!header) {
      throw new Error('Header stock opname tidak ditemukan')
    }

    if (header.status !== 'COUNTING') {
      throw new Error('Item hanya bisa diubah saat status COUNTING')
    }

    if (!['NOT_COUNTED', 'COUNTED'].includes(oldItem.countStatus)) {
      throw new Error('Item sudah direview dan tidak dapat diubah')
    }

    const oldWasCounted = oldItem.countStatus === 'COUNTED'
    const oldCountedQty = oldItem.countedQty || 0
    const oldDiffQty = oldItem.differenceQty || 0
    const oldDiffValue = Math.abs(oldItem.differenceValue || 0)

    const oldPlusQty = oldDiffQty > 0 ? oldDiffQty : 0
    const oldMinusQty = oldDiffQty < 0 ? Math.abs(oldDiffQty) : 0
    const oldHasDifference = oldDiffQty !== 0

    const inventory = await Inventory.findOne({
        shopId: oldItem.shopId,
        productId: oldItem.productId
    }).session(session)
    const systemQtyAtCount = inventory
        ? inventory.qty
        : 0

    const newDiffQty = countedQty - (oldItem.systemQtySnapshot || 0)
    const newDiffValue = newDiffQty * (oldItem.unitCost || 0)

    const newPlusQty = newDiffQty > 0 ? newDiffQty : 0
    const newMinusQty = newDiffQty < 0 ? Math.abs(newDiffQty) : 0
    const newHasDifference = newDiffQty !== 0

    const countedItemsDelta = oldWasCounted ? 0 : 1
    const totalCountedQtyDelta = countedQty - oldCountedQty
    const differenceItemsDelta =
      (newHasDifference ? 1 : 0) - (oldHasDifference ? 1 : 0)

    const totalPlusQtyDelta = newPlusQty - oldPlusQty
    const totalMinusQtyDelta = newMinusQty - oldMinusQty
    const totalDifferenceValueDelta =
      Math.abs(newDiffValue) - oldDiffValue

    oldItem.countedQty = countedQty
    oldItem.systemQtyAtCount = systemQtyAtCount
    oldItem.differenceQty = newDiffQty
    oldItem.differenceValue = newDiffValue
    if (oldItem.countStatus === 'NOT_COUNTED') {
        oldItem.countStatus = 'COUNTED'
    }
    oldItem.countedAt = oldItem.countedAt || new Date()
    oldItem.countedBy = oldItem.countedBy || req.user?._id || null
    oldItem.lastUpdatedAt = new Date()
    oldItem.lastUpdatedBy = req.user?._id || null

    await oldItem.save({ session })

    await StockOpname.updateOne(
      { _id: header._id },
      {
        $inc: {
          countedItems: countedItemsDelta,
          totalCountedQty: totalCountedQtyDelta,
          differenceItems: differenceItemsDelta,
          totalPlusQty: totalPlusQtyDelta,
          totalMinusQty: totalMinusQtyDelta,
          totalDifferenceValue: totalDifferenceValueDelta
        }
      },
      { session }
    )

    await session.commitTransaction()

    const updatedHeader = await StockOpname.findById(header._id).lean()
    const updatedItem = await StockOpnameItem.findById(itemId).lean()

    res.json({
      status: true,
      item: updatedItem,
      summary: {
        totalItems: updatedHeader.totalItems,
        countedItems: updatedHeader.countedItems,
        recheckItems: updatedHeader.recheckItems,
        differenceItems: updatedHeader.differenceItems,
        totalSystemQty: updatedHeader.totalSystemQty,
        totalCountedQty: updatedHeader.totalCountedQty,
        totalPlusQty: updatedHeader.totalPlusQty,
        totalMinusQty: updatedHeader.totalMinusQty,
        totalDifferenceValue: updatedHeader.totalDifferenceValue
      }
    })

  } catch (err) {
    await session.abortTransaction()

    res.status(500).json({
      status: false,
      message: err.message
    })
  } finally {
    session.endSession()
  }
}

exports.postBatch = async (req, res) => {

  const stockOpnameId = req.params.id
  const userId = req.user?._id || null

  try {
    if (!mongoose.Types.ObjectId.isValid(stockOpnameId)) {
      return res.status(400).json({
        status: false,
        message: 'ID Stock Opname tidak valid'
      })
    }

    const header = await StockOpname.findById(stockOpnameId).lean()

    if (!header) {
      return res.status(404).json({
        status: false,
        message: 'Stock Opname tidak ditemukan'
      })
    }

    if (header.status !== 'COUNTING') {
      return res.status(400).json({
        status: false,
        message: 'Stock Opname tidak dapat diposting'
      })
    }

    const items = await StockOpnameItem.find({
      stockOpnameId,
      countStatus: 'COUNTED'
    })
      .sort({ countedAt: 1 })
      .lean()

    if (!items.length) {
      return res.status(400).json({
        status: false,
        message: 'Tidak ada item yang siap diposting'
      })
    }

    let posted = 0
    const failed = []

    /*
     * Setiap item diproses dalam transaction sendiri.
     */
    for (const sourceItem of items) {

      const dbSession = await mongoose.startSession()

      try {
        await dbSession.withTransaction(async () => {
          /*
           * Ambil ulang item di dalam transaction.
           * Filter COUNTED mencegah item diposting dua kali.
           */
          const item = await StockOpnameItem.findOne({
            _id: sourceItem._id,
            stockOpnameId,
            countStatus: 'COUNTED'
          }).session(dbSession)

          if (!item) {
            console.log(sourceItem)
            throw new Error(
              `Item ${sourceItem.sku || sourceItem._id} sudah diproses atau tidak tersedia`
            )
          }

          if (
            item.countedQty === null ||
            item.countedQty === undefined ||
            item.systemQtyAtCount === null ||
            item.systemQtyAtCount === undefined
          ) {
            throw new Error(
              `Data counting SKU ${item.sku || item.productId} belum lengkap`
            )
          }

          /*
           * Ambil inventory terbaru.
           */

         

          let inventory = await Inventory.findOne({
            shopId: item.shopId,
            productId: item.productId
          }).session(dbSession)

          if (!inventory) {
            inventory = new Inventory({
              shopId: item.shopId,
              productId: item.productId,
              qty: 0
            })
          }

          const currentInventory = Number(inventory.qty || 0)
          const systemQtyAtCount = Number(item.systemQtyAtCount)
          const countedQty = Number(item.countedQty)

          /*
           * Transaksi yang terjadi setelah operator menyimpan counting.
           */
          const deltaTransaction =
            currentInventory - systemQtyAtCount

          /*
           * Rumus final Stock Opname ZHR.
           */
          const newInventoryQty = Math.max(
            countedQty + deltaTransaction,
            0
          )

          const adjustment =
            newInventoryQty - currentInventory

          inventory.qty = newInventoryQty

          await inventory.save({
            session: dbSession
          })

          /*
           * Hitung total stok produk seluruh lokasi.
           */
          
          const totalStockRows = await Inventory.aggregate([
            {
              $match: {
                productId: item.productId
              }
            },
            {
              $group: {
                _id: '$productId',
                qty: {
                  $sum: '$qty'
                }
              }
            }
          ]).session(dbSession)

          const productStock =
            Number(totalStockRows[0]?.qty || 0)

          const productUpdate = await Product.updateOne(
            {
              _id: item.productId
            },
            {
              $set: {
                stock: productStock
              }
            },
            {
              session: dbSession
            }
          )

          if (!productUpdate.matchedCount) {
            throw new Error(
              `Product SKU ${item.sku || item.productId} tidak ditemukan`
            )
          }

          /*
           * Simpan stock card.
           * Balance adalah total stok seluruh lokasi.
           */

          await StockCard.create(
            [
              {
                shopId: item.shopId,
                productId: item.productId,

                documentId: header._id,
                documentName: 'Stock Opname',
                document: header.stockOpnameNumber,
                type: 'STOCK_OPNAME',

                stockIn:
                  adjustment > 0
                    ? adjustment
                    : 0,

                stockOut:
                  adjustment < 0
                    ? Math.abs(adjustment)
                    : 0,

                qtyBefore: currentInventory,
                qtyAfter: newInventoryQty,

                balance: productStock,

                remarks: 'Stock Opname',
                userId
              }
            ],
            {
              session: dbSession
            }
          )

          /*
           * Tandai item sudah diposting.
           */
          item.countStatus = 'POSTED'
          item.postedAt = new Date()
          item.postedBy = userId
          item.lastUpdatedAt = new Date()
          item.lastUpdatedBy = userId

          await item.save({
            session: dbSession
          })
          /*
           * Tambahkan progress posting header.
           */

        })
        posted += 1

      } catch (err) {
        console.error(
          `Gagal posting SKU ${sourceItem.sku || sourceItem._id}:`,
          err
        )

        failed.push({
          itemId: sourceItem._id,
          sku: sourceItem.sku,
          message: err.message
        })

      } finally {
        await dbSession.endSession()
      }
    }

    /*
     * Cek penyelesaian session setelah seluruh batch diproses.
     */
    const remain = await StockOpnameItem.countDocuments({
      stockOpnameId,
      countStatus: {
        $in: [
          'NOT_COUNTED',
          'COUNTED'
        ]
      }
    })

    let finished = false

    if (remain === 0) {
      const now = new Date()

      await StockOpname.updateOne(
        {
          _id: stockOpnameId,
          status: 'COUNTING'
        },
        {
          $set: {
            status: 'FINISHED',
            finishedAt: now,
            postedAt: now,
            postedBy: userId
          }
        }
      )

      finished = true
    }

    if (posted > 0) {
        await StockOpname.updateOne(
            {
                _id: header._id
            },
            {
                $inc: {
                    postedItems: posted
                }
            }
        )
    }

    return res.status(200).json({
      status: failed.length === 0,
      message:
        failed.length === 0
          ? `${posted} item berhasil diposting`
          : `${posted} item berhasil dan ${failed.length} item gagal diposting`,
      totalReady: items.length,
      posted,
      failedCount: failed.length,
      failed,
      remain,
      finished
    })

  } catch (err) {
    console.error('postBatch error:', err)

    return res.status(500).json({
      status: false,
      message: err.message
    })
  }
}


exports.scanRandomItem = async (req, res) => {
  try {
    const shopId = req.user.shopId
    const sku = req.body.sku
    
    const activeSession = await StockOpname.findOne({
      shopId,
      opnameType: 'RANDOM',
      status: {
        $in: [
          'DRAFT',
          'COUNTING',
        ]
      }
    })
    let session = activeSession
    if(!activeSession) {
      const doc = await StockOpname.create({
        stockOpnameNumber: await generateNumber(),
        shopId,
        opnameType: 'RANDOM',
        remarks: 'Stock Opname Random',
        userId: req.body.userId
      })
      session = doc
    }
  
    const barcode = sku
    
    // item sudah pernah discan?
    const stockOpnameId = session._id
    let item = await StockOpnameItem.findOne({
      stockOpnameId,
      sku: barcode
    }).lean()
  
    if(item) {
      const inv = await Inventory.findOne({
          shopId,
          productId: item.productId
      }).lean()

      return res.json({
          status: true,
          found: true,
          alreadyCounted: item.countStatus !== 'NOT_COUNTED',
          item,
          inv
      })
    }
  
    // ambil data produk lengkap
    const rows = await Product.aggregate([
        {
            $match: {
                sku: barcode,
                isActive: true
            }
        },
        {
            $addFields: {
                parentGroupId: {
                    $ifNull: [
                        '$parentId',
                        '$_id'
                    ]
                }
            }
        },
        {
            $lookup: {
                from: 'products',
                localField: 'parentGroupId',
                foreignField: '_id',
                as: 'parent'
            }
        },
        {
            $unwind: {
                path: '$parent',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'categories',
                localField: 'categoryId',
                foreignField: '_id',
                as: 'category'
            }
        },
        {
            $unwind: {
                path: '$category',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                _id: 1,
                sku: 1,
                name: 1,
                parentId: '$parentGroupId',
                parentName: {
                    $ifNull: [
                        '$parent.name',
                        '$name'
                    ]
                },
                categoryId: 1,
                categoryName: '$category.name',
                purchase: 1,
                price: 1
            }
        }
    ])
    const product = rows[0]
    if(!product) {
      return res.status(404).json({
        status: false,
        found: false,
        message: 'SKU tidak ditemukan'
      })
    }
  
    // inventory saat scan
    const inv = await Inventory.findOne({
      shopId,
      productId: product._id
    }).lean()

    if(!inv) {
      return res.status(404).json({
        status: false,
        found: false,
        reason: 'NOT_IN_SESSION',
        message:
          'Barang bukan bagian dari Stock Opname.'
      })
    }
    const qty = Number(inv?.qty || 0)
  
    item = await StockOpnameItem.create({
        stockOpnameId: session._id,
        shopId,
        productId: product._id,
        sku: product.sku,
        name: product.name,
        parentId: product.parentId,
        parentName: product.parentName,
        categoryId: product.categoryId,
        categoryName: product.categoryName,
        systemQtySnapshot: qty,
        countedQty: null,
        differenceQty: 0,
        unitCost:
            product.purchase ||
            product.price ||
            0,
        differenceValue: 0,
        countStatus: 'NOT_COUNTED',
        note: '',
        countedAt: null,
        countedBy: null,
        lastUpdatedAt: null,
        lastUpdatedBy: null,
        sortKey: [
            product.categoryName || '',
            product.parentName || '',
            product.name || '',
            product.sku || ''
        ].join('|')
    })
  
    // scan pertam
    if(session.status === 'DRAFT') {
      await StockOpname.updateOne(
        {
            _id: session._id
        },
        {
            $set: {
                status: 'COUNTING',
                startedAt: new Date(),
                snapshotAt: new Date()
            },
            $inc: {
                totalItems: 1,
                totalSystemQty: qty
            }
        }
      )
    } else {
      await StockOpname.updateOne(
        {
            _id: session._id
        },
        {
            $inc: {
                totalItems: 1,
                totalSystemQty: qty
            }
        }
      )
    }
    return res.json({
        status: true,
        found: true,
        alreadyCounted: false,
        item,
        inv
    })
  } catch (error) {
   return res.status(500).json({
        status: false,
        message: error.message
    }) 
  }
}


exports.generateZeroCount = async (req, res) => {

    const dbSession = await mongoose.startSession()

    try {

        const stockOpnameId = req.params.id
        const userId = req.user?._id || null

        if (!mongoose.Types.ObjectId.isValid(stockOpnameId)) {
            return res.status(400).json({
                status: false,
                message: 'Stock Opname tidak valid'
            })
        }

        await dbSession.withTransaction(async () => {

            const header = await StockOpname.findById(stockOpnameId)
                .session(dbSession)

            if (!header) {
                throw new Error('Stock Opname tidak ditemukan')
            }

            if (header.status !== 'COUNTING') {
                throw new Error('Stock Opname tidak dalam proses COUNTING')
            }

            const items = await StockOpnameItem.find({
                stockOpnameId,
                countStatus: 'NOT_COUNTED'
            }).session(dbSession)

            if (!items.length) {
                throw new Error('Tidak ada item NOT_COUNTED')
            }

            /*
             * Ambil inventory sekaligus
             */
            const productIds = items.map(i => i.productId)

            const inventories = await Inventory.find({
                shopId: header.shopId,
                productId: {
                    $in: productIds
                }
            })
            .lean()
            .session(dbSession)

            const inventoryMap = new Map()

            inventories.forEach(inv => {
                inventoryMap.set(
                    inv.productId.toString(),
                    inv.qty
                )
            })

            const now = new Date()

            const ops = items.map(item => {

                const systemQtyAtCount =
                    Number(
                        inventoryMap.get(
                            item.productId.toString()
                        ) || 0
                    )

                const differenceQty =
                    0 - Number(item.systemQtySnapshot || 0)

                const differenceValue =
                    differenceQty *
                    Number(item.unitCost || 0)

                return {

                    updateOne: {

                        filter: {
                            _id: item._id
                        },

                        update: {

                            $set: {

                                countedQty: 0,

                                systemQtyAtCount,

                                differenceQty,

                                differenceValue,

                                countStatus: 'COUNTED',

                                countedAt: now,

                                countedBy: userId,

                                lastUpdatedAt: now,

                                lastUpdatedBy: userId

                            }

                        }

                    }

                }

            })

            await StockOpnameItem.bulkWrite(
                ops,
                {
                    session: dbSession,
                    ordered: false
                }
            )

            /*
             * Hitung ulang summary
             */

            const summaryRows =
                await StockOpnameItem.aggregate([

                    {
                        $match: {
                            stockOpnameId:
                                new mongoose.Types.ObjectId(stockOpnameId)
                        }
                    },

                    {
                        $group: {

                            _id: null,

                            totalItems: {
                                $sum: 1
                            },

                            countedItems: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                '$countStatus',
                                                'COUNTED'
                                            ]
                                        },
                                        1,
                                        0
                                    ]
                                }
                            },

                            recheckItems: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                '$countStatus',
                                                'RECHECK'
                                            ]
                                        },
                                        1,
                                        0
                                    ]
                                }
                            },

                            differenceItems: {
                                $sum: {
                                    $cond: [
                                        {
                                            $ne: [
                                                '$differenceQty',
                                                0
                                            ]
                                        },
                                        1,
                                        0
                                    ]
                                }
                            },

                            totalSystemQty: {
                                $sum: '$systemQtySnapshot'
                            },

                            totalCountedQty: {
                                $sum: {
                                    $ifNull: [
                                        '$countedQty',
                                        0
                                    ]
                                }
                            },

                            totalPlusQty: {
                                $sum: {
                                    $cond: [
                                        {
                                            $gt: [
                                                '$differenceQty',
                                                0
                                            ]
                                        },
                                        '$differenceQty',
                                        0
                                    ]
                                }
                            },

                            totalMinusQty: {
                                $sum: {
                                    $cond: [
                                        {
                                            $lt: [
                                                '$differenceQty',
                                                0
                                            ]
                                        },
                                        {
                                            $abs: '$differenceQty'
                                        },
                                        0
                                    ]
                                }
                            },

                            totalDifferenceValue: {
                                $sum: {
                                    $abs: '$differenceValue'
                                }
                            }

                        }

                    }

                ]).session(dbSession)

            const summary = summaryRows[0]

            await StockOpname.updateOne(
                {
                    _id: stockOpnameId
                },
                {
                    $set: {

                        totalItems:
                            summary.totalItems,

                        countedItems:
                            summary.countedItems,

                        recheckItems:
                            summary.recheckItems,

                        differenceItems:
                            summary.differenceItems,

                        totalSystemQty:
                            summary.totalSystemQty,

                        totalCountedQty:
                            summary.totalCountedQty,

                        totalPlusQty:
                            summary.totalPlusQty,

                        totalMinusQty:
                            summary.totalMinusQty,

                        totalDifferenceValue:
                            summary.totalDifferenceValue

                    }
                },
                {
                    session: dbSession
                }
            )

        })

        return res.json({
            status: true,
            message: 'Generate counting 0 berhasil.'
        })

    } catch (err) {

        return res.status(500).json({
            status: false,
            message: err.message
        })

    } finally {

        dbSession.endSession()

    }

}