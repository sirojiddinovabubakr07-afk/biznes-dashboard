import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { getDb } from './database/db.js';

import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import ordersRoutes from './routes/orders.js';
import expensesRoutes from './routes/expenses.js';
import goalsRoutes from './routes/goals.js';
import dashboardRoutes from './routes/dashboard.js';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

getDb(); 

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Deploy uchun: public/ ichidan, lokal uchun: ../client/dist dan
const distPath = path.join(process.cwd(), 'public');
const fallbackPath = path.join(process.cwd(), '../client/dist');
const servePath = fs.existsSync(distPath) ? distPath : fallbackPath;
app.use(express.static(servePath));

app.get('*', (req, res) => {
  res.sendFile(path.join(servePath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BizDashboard server ishga tushdi: http://localhost:${PORT}`);
});
