import express from 'express';
import { getDb } from '../database/db.js';

const router = express.Router();

router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    
    const today = db.prepare(`
      SELECT 
        COUNT(*) as total_orders, 
        COALESCE(SUM(total_price), 0) as revenue, 
        COALESCE(SUM(profit), 0) as profit
      FROM orders
      WHERE date(order_date) = date('now', 'localtime')
    `).get();

    const productStats = db.prepare(`
      SELECT 
        COUNT(*) as total_products,
        SUM(CASE WHEN stock_quantity < 5 THEN 1 ELSE 0 END) as low_stock_count
      FROM products
      WHERE is_active = 1
    `).get();

    const platformStatsAllTime = db.prepare(`
      SELECT platform, COUNT(*) as count 
      FROM orders 
      GROUP BY platform
    `).all();

    const platformStatsToday = db.prepare(`
      SELECT platform, COUNT(*) as count 
      FROM orders 
      WHERE date(order_date) = date('now', 'localtime')
      GROUP BY platform
    `).all();

    const profitTrend = db.prepare(`
      SELECT date(order_date) as date, COALESCE(SUM(profit), 0) as daily_profit
      FROM orders
      WHERE order_date >= datetime('now', '-30 days', 'localtime')
      GROUP BY date(order_date)
      ORDER BY date(order_date) ASC
    `).all();

    const topProducts = db.prepare(`
      SELECT p.name, SUM(o.quantity) as sold_count, SUM(o.profit) as total_profit
      FROM orders o
      JOIN products p ON o.product_id = p.id
      GROUP BY p.id
      ORDER BY sold_count DESC
      LIMIT 5
    `).all();

    const recentOrders = db.prepare(`
      SELECT o.*, p.name as product_name 
      FROM orders o
      JOIN products p ON o.product_id = p.id
      ORDER BY o.order_date DESC
      LIMIT 10
    `).all();

    const expensesToday = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date = date('now', 'localtime')`).get().total;
    const expensesWeek = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date >= date('now', '-7 days', 'localtime')`).get().total;
    const expensesMonth = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date >= date('now', 'start of month', 'localtime')`).get().total;

    const goals = db.prepare('SELECT * FROM goals WHERE is_completed = 0').all();

    const totalRevenueAllTime = db.prepare(`SELECT COALESCE(SUM(total_price), 0) as total FROM orders`).get().total;
    
    let businessLevel = 'Yangi Boshlovchi';
    if (totalRevenueAllTime >= 100000000) businessLevel = 'Mogul';
    else if (totalRevenueAllTime >= 50000000) businessLevel = 'Boss';
    else if (totalRevenueAllTime >= 10000000) businessLevel = 'Professional';
    else if (totalRevenueAllTime >= 1000000) businessLevel = 'Tajribali';

    const datesWithOrders = db.prepare(`
      SELECT DISTINCT date(order_date) as d 
      FROM orders 
      ORDER BY d DESC
    `).all().map(r => r.d);

    let streak = 0;
    const todayStr = new Date().toISOString().split('T')[0];
    let currentDate = new Date(todayStr);
    
    for (const d of datesWithOrders) {
      if (d === currentDate.toISOString().split('T')[0]) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        const yesterdayStr = new Date(currentDate);
        yesterdayStr.setDate(yesterdayStr.getDate() - 1);
        if(d === yesterdayStr.toISOString().split('T')[0] && streak === 0) {
           streak++;
           currentDate = yesterdayStr;
           currentDate.setDate(currentDate.getDate() - 1);
        } else {
           break;
        }
      }
    }

    const allOrders = db.prepare('SELECT o.*, p.name as product_name FROM orders o LEFT JOIN products p ON o.product_id = p.id').all();
    const totalDebt = allOrders.reduce((sum, o) => sum + (Number(o.debt_amount) || 0), 0);
    const debtOrders = allOrders.filter(o => (Number(o.debt_amount) || 0) > 0).slice(0, 5);

    const totalProfitAllTime = allOrders.reduce((sum, o) => sum + (Number(o.profit) || 0), 0);

    res.json({
      today,
      products: productStats,
      platforms: { allTime: platformStatsAllTime, today: platformStatsToday },
      profitTrend,
      topProducts,
      recentOrders,
      expenses: { today: expensesToday, week: expensesWeek, month: expensesMonth },
      goals,
      streak,
      businessLevel,
      totalRevenueAllTime,
      totalProfitAllTime,
      totalDebt,
      debtOrders
    });

  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.get('/comparison', (req, res) => {
  try {
    const db = getDb();
    
    res.json({ message: 'Taqqoslash ma\'lumotlari (hozircha ishlab chiqilmoqda)' });
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

export default router;
