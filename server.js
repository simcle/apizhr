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
const companyRouters = require('./src/routers/company');
const shippingRoutes = require('./src/routers/shipping');
const shopRoutes = require('./src/routers/shops');
const marketplaceRoutes = require('./src/routers/marketplaces');
const bankRoutes = require('./src/routers/banks');
const employeeRoutes = require('./src/routers/employee');
const attlogsRouters = require('./src/routers/attlogs');
const brandRoutes = require('./src/routers/brand');
const categoryRoutes = require('./src/routers/categories');
const productRoutes = require('./src/routers/products');
const stockopnameRoutes = require('./src/routers/stockopname');

app.use('/webhook', webhookRouters);
app.use('/auth', userRoutes);
app.use('/setting', authenticateToken, companyRouters);
app.use('/setting', authenticateToken, shippingRoutes);
app.use('/setting', authenticateToken, bankRoutes);
app.use('/setting', authenticateToken, shopRoutes);
app.use('/setting', authenticateToken, marketplaceRoutes);
app.use('/employee', authenticateToken, employeeRoutes);
app.use('/attlog', authenticateToken, attlogsRouters);
app.use('/brands', authenticateToken, brandRoutes);
app.use('/categories', authenticateToken, categoryRoutes );
app.use('/products', authenticateToken, productRoutes)
app.use('/stockopname', authenticateToken, stockopnameRoutes);

const PORT = process.env.PORT || 3000;
mongoose.set("strictQuery", false);
mongoose.connect(process.env.DATA_BASE)
.then(() => {
    app.listen(PORT, () => console.log(`Server listen on port ${PORT}`));
});