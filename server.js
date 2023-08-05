require('dotenv').config();

process.env.TZ= 'Asia/Jakarta'
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const dir = path.join(__dirname, 'public');
app.use('/public/', express.static(dir));

const authenticateToken = require('./authenticate');

const webhookRouters = require('./src/routers/webhook');
const userRoutes = require('./src/routers/auth');
const dashboardRoutes = require('./src/routers/dashboard');
const companyRouters = require('./src/routers/company');
const shippingRoutes = require('./src/routers/shipping');
const shopRoutes = require('./src/routers/shops');
const marketplaceRoutes = require('./src/routers/marketplaces');
const bankRoutes = require('./src/routers/banks');
const employeeRoutes = require('./src/routers/employee');
const attlogsRouters = require('./src/routers/attlogs');
const supplierRoutes = require('./src/routers/supplier');
const brandRoutes = require('./src/routers/brand');
const categoryRoutes = require('./src/routers/categories');
const productRoutes = require('./src/routers/products');
const stockopnameRoutes = require('./src/routers/stockopname');
const salesRoutes = require('./src/routers/sales');
const ngolesRoutes = require('./src/routers/ngoles');
const resellerRoutes = require('./src/routers/reseller');
const pengeluaranRoutes = require('./src/routers/pengeluaran');
const posRoutes = require('./src/routers/pos');
const receiptsRoutes = require('./src/routers/receipts');
const transferRoutes = require('./src/routers/transfer');
const stockCardRoutes = require('./src/routers/stockCard');
const inventoryRoutes = require('./src/routers/inventory');
const indonesiaRoutes = require('./src/routers/indonesia');
const customerRoutes = require('./src/routers/customer');
const onlineRoutes = require('./src/routers/online');
const rajaongkirRoutes = require('./src/routers/rajaongkir');
const biteshipRoutes = require('./src/routers/biteship');

app.use('/webhook', webhookRouters);
app.use('/auth', userRoutes);
app.use('/dashboard', authenticateToken, dashboardRoutes);
app.use('/setting', authenticateToken, companyRouters);
app.use('/setting', authenticateToken, shippingRoutes);
app.use('/setting', authenticateToken, bankRoutes);
app.use('/setting', authenticateToken, shopRoutes);
app.use('/setting', authenticateToken, marketplaceRoutes);
app.use('/employee', authenticateToken, employeeRoutes);
app.use('/attlog', authenticateToken, attlogsRouters);
app.use('/supplier', authenticateToken, supplierRoutes);
app.use('/brands', authenticateToken, brandRoutes);
app.use('/categories', authenticateToken, categoryRoutes );
app.use('/products', authenticateToken, productRoutes)
app.use('/stockopname', authenticateToken, stockopnameRoutes);
app.use('/sales', authenticateToken, salesRoutes);
app.use('/ngoles', authenticateToken, ngolesRoutes);
app.use('/reseller', authenticateToken, resellerRoutes);
app.use('/pengeluaran', authenticateToken, pengeluaranRoutes);
app.use('/pos', authenticateToken, posRoutes);
app.use('/receipts', authenticateToken, receiptsRoutes);
app.use('/transfer', authenticateToken, transferRoutes);
app.use('/stockcard', authenticateToken, stockCardRoutes);
app.use('/inventory', authenticateToken, inventoryRoutes);
app.use('/indonesia', authenticateToken, indonesiaRoutes);
app.use('/customer', authenticateToken, customerRoutes);
app.use('/online', authenticateToken, onlineRoutes);
app.use('/rajaongkir', authenticateToken, rajaongkirRoutes);
app.use('/biteship', authenticateToken, biteshipRoutes);

const PORT = process.env.PORT || 3000;
mongoose.set("strictQuery", false);
mongoose.connect(process.env.DATA_BASE, {
    autoIndex: true
})
.then(() => {
    app.listen(PORT, () => console.log(`Server listen on port ${PORT}`));
});