const SalesModel = require('../models/sales');
const OnlineModel = require('../models/online');
const NgolesModel = require('../models/ngoles');
const ResellerModel = require('../models/reseller');
const MitraPaymentModel = require('../models/mitraPayment');
const BankModel = require('../models/banks');
const CustomerModel = require('../models/customer');
const MarketplaceModel = require('../models/marketplaces');

function parseDate(value, name) {
    if(!value) {
        throw new Error(`${name} is required`);
    }

    const date = new Date(value);

    if(Number.isNaN(date.getTime())) {
        throw new Error(`${name} is invalid`);
    }

    return date;
}

function parseRange(query) {
    const from = parseDate(query.from, 'from');
    const to = parseDate(query.to, 'to');

    if(from >= to) {
        const error = new Error('from must be earlier than to');
        error.statusCode = 400;
        throw error;
    }

    return {from, to};
}

function toId(value) {
    return value ? String(value) : null;
}

function pushLeg(records, {
    id,
    source,
    sourceId,
    transactionNo,
    transactionAt,
    shopId,
    paymentMethod,
    destinationId,
    amount,
    customerId = null
}) {
    const numericAmount = Number(amount);

    if(!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return;
    }

    if(!transactionAt || Number.isNaN(new Date(transactionAt).getTime())) {
        throw new Error(`Invalid transactionAt for ${id}`);
    }

    if(paymentMethod !== 'CASH' && !destinationId) {
        throw new Error(`Missing destinationId for ${id}`);
    }

    records.push({
        id,
        source,
        sourceId: String(sourceId),
        transactionNo: transactionNo || '',
        transactionAt,
        shopId: toId(shopId),
        paymentMethod,
        destinationType: paymentMethod === 'CASH' ? null : 'BANK',
        destinationId: paymentMethod === 'CASH' ? null : String(destinationId),
        amount: numericAmount,
        _customerId: toId(customerId)
    });
}

function normalizePaymentBreakdown({
    source,
    sourceId,
    eventId,
    transactionNo,
    transactionAt,
    shopId,
    bankId,
    cash,
    debit,
    transfer
}) {
    const records = [];
    const prefix = eventId
        ? `${source}:${sourceId}:${eventId}`
        : `${source}:${sourceId}`;

    pushLeg(records, {
        id: `${prefix}:CASH`,
        source,
        sourceId,
        transactionNo,
        transactionAt,
        shopId,
        paymentMethod: 'CASH',
        destinationId: null,
        amount: cash
    });

    pushLeg(records, {
        id: `${prefix}:DEBIT`,
        source,
        sourceId,
        transactionNo,
        transactionAt,
        shopId,
        paymentMethod: 'DEBIT',
        destinationId: bankId,
        amount: debit
    });

    pushLeg(records, {
        id: `${prefix}:TRANSFER`,
        source,
        sourceId,
        transactionNo,
        transactionAt,
        shopId,
        paymentMethod: 'TRANSFER',
        destinationId: bankId,
        amount: transfer
    });

    return records;
}

function toPublicRecord(record) {
    return {
        id: record.id,
        source: record.source,
        sourceId: record.sourceId,
        transactionNo: record.transactionNo,
        transactionAt: record.transactionAt,
        shopId: record.shopId,
        paymentMethod: record.paymentMethod,
        destinationType: record.destinationType,
        destinationId: record.destinationId,
        amount: record.amount
    };
}

async function resolveCanonicalDestinations(records) {
    const nonCashRecords = records.filter(record => record.paymentMethod !== 'CASH');

    const bankIds = [...new Set(
        nonCashRecords.map(record => record.destinationId)
    )];

    const banks = bankIds.length > 0
        ? await BankModel.find({
            _id: {
                $in: bankIds
            }
        })
        .select('_id name')
        .lean()
        : [];

    const bankById = new Map(
        banks.map(bank => [String(bank._id), bank])
    );

    for(const bankId of bankIds) {
        const bank = bankById.get(bankId);

        if(!bank) {
            throw new Error(`Bank not found for destinationId ${bankId}`);
        }

        if(!bank.name) {
            throw new Error(`Bank name is empty for destinationId ${bankId}`);
        }
    }

    const marketplaceRecords = [];

    for(const record of nonCashRecords) {
        const bank = bankById.get(record.destinationId);
        const isMarketplaceClearing = bank.name.trim().toUpperCase() === 'MARKETPLACE';

        if(record.source === 'ONLINE' && isMarketplaceClearing) {
            marketplaceRecords.push(record);
        }
    }

    if(marketplaceRecords.length === 0) {
        return records;
    }

    const missingCustomerRecord = marketplaceRecords.find(record => !record._customerId);

    if(missingCustomerRecord) {
        throw new Error(`Missing customerId for ${missingCustomerRecord.id}`);
    }

    const customerIds = [...new Set(
        marketplaceRecords.map(record => record._customerId)
    )];

    const customers = await CustomerModel.find({
        _id: {
            $in: customerIds
        }
    })
    .select('_id marketplaceId')
    .lean();

    const customerById = new Map(
        customers.map(customer => [String(customer._id), customer])
    );

    const marketplaceIds = new Set();

    for(const record of marketplaceRecords) {
        const customer = customerById.get(record._customerId);

        if(!customer) {
            throw new Error(`Customer not found for ${record.id}`);
        }

        if(!customer.marketplaceId) {
            throw new Error(`Missing marketplaceId for ${record.id}`);
        }

        marketplaceIds.add(String(customer.marketplaceId));
    }

    const marketplaces = await MarketplaceModel.find({
        _id: {
            $in: [...marketplaceIds]
        }
    })
    .select('_id name')
    .lean();

    const marketplaceById = new Map(
        marketplaces.map(marketplace => [
            String(marketplace._id),
            marketplace
        ])
    );

    for(const record of marketplaceRecords) {
        const customer = customerById.get(record._customerId);
        const marketplaceId = String(customer.marketplaceId);
        const marketplace = marketplaceById.get(marketplaceId);

        if(!marketplace) {
            throw new Error(`Marketplace not found for ${record.id}`);
        }

        if(!marketplace.name) {
            throw new Error(`Marketplace name is empty for ${record.id}`);
        }

        record.destinationType = 'MARKETPLACE';
        record.destinationId = marketplaceId;
    }

    return records;
}

async function getCanonicalCashIn(from, to) {
    const [
        sales,
        online,
        ngoles,
        mitraPayments,
        resellers
    ] = await Promise.all([
        SalesModel.find({
            createdAt: {
                $gte: from,
                $lt: to
            }
        })
        .select('_id salesNo shopId createdAt bankId cash debit transfer')
        .lean(),

        OnlineModel.find({
            createdAt: {
                $gte: from,
                $lt: to
            }
        })
        .select('_id onlineNo customerId createdAt bankId grandTotal')
        .lean(),

        NgolesModel.find({
            tanggalBayar: {
                $gte: from,
                $lt: to
            },
            status: 'LUNAS'
        })
        .select('_id ngolesNo shopId tanggalBayar bankId cash debit transfer')
        .lean(),

        MitraPaymentModel.find({
            createdAt: {
                $gte: from,
                $lt: to
            }
        })
        .select('_id paymentNo createdAt bankId cash debit transfer')
        .lean(),

        ResellerModel.find({
            payments: {
                $elemMatch: {
                    paymentDate: {
                        $gte: from,
                        $lt: to
                    }
                }
            }
        })
        .select('_id resellerNo shopId payments')
        .lean()
    ]);

    const records = [];

    for(const sale of sales) {
        records.push(...normalizePaymentBreakdown({
            source: 'OFFLINE',
            sourceId: sale._id,
            transactionNo: sale.salesNo,
            transactionAt: sale.createdAt,
            shopId: sale.shopId,
            bankId: sale.bankId,
            cash: sale.cash,
            debit: sale.debit,
            transfer: sale.transfer
        }));
    }

    for(const item of online) {
        pushLeg(records, {
            id: `ONLINE:${item._id}:TRANSFER`,
            source: 'ONLINE',
            sourceId: item._id,
            transactionNo: item.onlineNo,
            transactionAt: item.createdAt,
            shopId: null,
            paymentMethod: 'TRANSFER',
            destinationId: item.bankId,
            amount: item.grandTotal,
            customerId: item.customerId
        });
    }

    for(const item of ngoles) {
        records.push(...normalizePaymentBreakdown({
            source: 'NGOLES',
            sourceId: item._id,
            transactionNo: item.ngolesNo,
            transactionAt: item.tanggalBayar,
            shopId: item.shopId,
            bankId: item.bankId,
            cash: item.cash,
            debit: item.debit,
            transfer: item.transfer
        }));
    }

    for(const payment of mitraPayments) {
        records.push(...normalizePaymentBreakdown({
            source: 'MITRA',
            sourceId: payment._id,
            transactionNo: payment.paymentNo,
            transactionAt: payment.createdAt,
            shopId: null,
            bankId: payment.bankId,
            cash: payment.cash,
            debit: payment.debit,
            transfer: payment.transfer
        }));
    }

    for(const reseller of resellers) {
        for(const payment of reseller.payments || []) {
            const paymentDate = new Date(payment.paymentDate);

            if(Number.isNaN(paymentDate.getTime()) || paymentDate < from || paymentDate >= to) {
                continue;
            }

            if(!payment._id) {
                throw new Error(`Missing payment _id for RESELLER:${reseller._id}`);
            }

            records.push(...normalizePaymentBreakdown({
                source: 'RESELLER',
                sourceId: reseller._id,
                eventId: payment._id,
                transactionNo: reseller.resellerNo,
                transactionAt: payment.paymentDate,
                shopId: reseller.shopId,
                bankId: payment.bankId,
                cash: payment.cash,
                debit: payment.debit,
                transfer: payment.transfer
            }));
        }
    }

    await resolveCanonicalDestinations(records);

    records.sort((a, b) => {
        const dateCompare = new Date(a.transactionAt) - new Date(b.transactionAt);

        if(dateCompare !== 0) {
            return dateCompare;
        }

        return a.id.localeCompare(b.id);
    });

    return records;
}

function handleError(res, error, operation) {
    console.error(`${operation}:`, error);

    if(error.statusCode === 400 ||
        error.message === 'from is required' ||
        error.message === 'to is required' ||
        error.message === 'from is invalid' ||
        error.message === 'to is invalid') {
        return res.status(400).json({
            message: error.message
        });
    }

    return res.status(500).json({
        message: error.message || `Failed to ${operation}`
    });
}

exports.getCashInSource = async (req, res) => {
    try {
        const {from, to} = parseRange(req.query);
        const records = await getCanonicalCashIn(from, to);

        return res.status(200).json({
            from,
            to,
            count: records.length,
            data: records.map(toPublicRecord)
        });
    } catch(error) {
        return handleError(res, error, 'getCashInSource');
    }
};

exports.getCashInSummary = async (req, res) => {
    try {
        const {from, to} = parseRange(req.query);
        const records = await getCanonicalCashIn(from, to);

        const accountAmounts = new Map();

        for(const record of records) {
            const key = record.paymentMethod === 'CASH'
                ? 'CASH'
                : `${record.destinationType}:${record.destinationId}`;

            if(!accountAmounts.has(key)) {
                accountAmounts.set(key, {
                    type: record.paymentMethod === 'CASH'
                        ? 'CASH'
                        : record.destinationType,
                    destinationId: record.paymentMethod === 'CASH'
                        ? null
                        : record.destinationId,
                    amount: 0
                });
            }

            accountAmounts.get(key).amount += record.amount;
        }

        const bankIds = [];
        const marketplaceIds = [];

        for(const account of accountAmounts.values()) {
            if(account.type === 'BANK') {
                bankIds.push(account.destinationId);
            }

            if(account.type === 'MARKETPLACE') {
                marketplaceIds.push(account.destinationId);
            }
        }

        const [banks, marketplaces] = await Promise.all([
            bankIds.length > 0
                ? BankModel.find({
                    _id: {
                        $in: bankIds
                    }
                })
                .select('_id name')
                .lean()
                : [],

            marketplaceIds.length > 0
                ? MarketplaceModel.find({
                    _id: {
                        $in: marketplaceIds
                    }
                })
                .select('_id name')
                .lean()
                : []
        ]);

        const bankById = new Map(
            banks.map(bank => [
                String(bank._id),
                bank
            ])
        );

        const marketplaceById = new Map(
            marketplaces.map(marketplace => [
                String(marketplace._id),
                marketplace
            ])
        );

        const accounts = [];

        for(const account of accountAmounts.values()) {
            if(account.type === 'CASH') {
                accounts.push({
                    type: 'CASH',
                    destinationId: null,
                    name: 'TUNAI',
                    amount: account.amount
                });

                continue;
            }

            if(account.type === 'BANK') {
                const bank = bankById.get(account.destinationId);

                if(!bank) {
                    throw new Error(`Bank not found for destinationId ${account.destinationId}`);
                }

                if(!bank.name) {
                    throw new Error(`Bank name is empty for destinationId ${account.destinationId}`);
                }

                accounts.push({
                    type: 'BANK',
                    destinationId: account.destinationId,
                    name: bank.name,
                    amount: account.amount
                });

                continue;
            }

            if(account.type === 'MARKETPLACE') {
                const marketplace = marketplaceById.get(account.destinationId);

                if(!marketplace) {
                    throw new Error(`Marketplace not found for destinationId ${account.destinationId}`);
                }

                if(!marketplace.name) {
                    throw new Error(`Marketplace name is empty for destinationId ${account.destinationId}`);
                }

                accounts.push({
                    type: 'MARKETPLACE',
                    destinationId: account.destinationId,
                    name: marketplace.name,
                    amount: account.amount
                });

                continue;
            }

            throw new Error(`Unsupported destination type ${account.type}`);
        }

        accounts.sort((a, b) => {
            if(a.type === 'CASH' && b.type !== 'CASH') {
                return -1;
            }

            if(a.type !== 'CASH' && b.type === 'CASH') {
                return 1;
            }

            return a.name.localeCompare(b.name);
        });

        const total = accounts.reduce(
            (sum, account) => sum + account.amount,
            0
        );

        return res.status(200).json({
            from,
            to,
            total,
            accounts
        });
    } catch(error) {
        return handleError(res, error, 'getCashInSummary');
    }
};