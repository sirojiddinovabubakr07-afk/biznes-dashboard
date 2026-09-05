import express from 'express';
import { getDb } from '../database/db.js';

const router = express.Router();

function getPeriodCondition(period) {
  switch (period) {
    case '7d': return "order_date >= datetime('now', '-7 days', 'localtime')";
    case '15d': return "order_date >= datetime('now', '-15 days', 'localtime')";
    case '1m': return "order_date >= datetime('now', '-1 month', 'localtime')";
    case '6m': return "order_date >= datetime('now', '-6 months', 'localtime')";
    case '1y': return "order_date >= datetime('now', '-1 year', 'localtime')";
    default: return "1=1";
  }
}

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { platform, period, status, has_debt } = req.query;
    
    let query = `
      SELECT o.*, p.name as product_name, p.image_url, p.purchase_price as base_purchase_price
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (platform && platform !== 'all') {
      query += ` AND o.platform = ?`;
      params.push(platform);
    }
    
    if (status && status !== 'all') {
      query += ` AND o.status = ?`;
      params.push(status);
    }
    
    if (has_debt === 'true') {
      query += ` AND o.debt_amount > 0`;
    }
    
    if (period && period !== 'all') {
      query += ` AND o.${getPeriodCondition(period)}`;
    }
    
    query += ' ORDER BY o.order_date DESC';
    
    const orders = db.prepare(query).all(...params);
    res.json(orders);
  } catch (error) {
    console.error('Orders GET error:', error);
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const { period } = req.query;
    
    let condition = "1=1";
    if (period && period !== 'all') {
      condition = getPeriodCondition(period);
    }
    
    const query = `
      SELECT platform, COUNT(*) as order_count, SUM(total_price) as total_revenue, SUM(profit) as total_profit
      FROM orders
      WHERE ${condition}
      GROUP BY platform
    `;
    
    const stats = db.prepare(query).all();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const {
      product_id,
      platform = 'uzum',
      quantity = 1,
      unit_price,
      purchase_price,
      total_price,
      paid_amount,
      debt_amount,
      customer_name = '',
      customer_phone = '',
      delivery_address = '',
      delivery_fee = 0,
      status = 'yangi',
      order_date,
      note = ''
    } = req.body;

    const product = db.prepare('SELECT id, name, purchase_price, selling_price, stock_quantity FROM products WHERE id = ?').get(product_id);
    
    if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
    if (product.stock_quantity < Number(quantity)) {
      return res.status(400).json({ error: `Omborda yetarli tovar yo'q! Hozirda qoldiq: ${product.stock_quantity} dona` });
    }

    const effectiveUnitPrice = Number(unit_price) || Number(product.selling_price);
    const effectivePurchasePrice = Number(purchase_price) || Number(product.purchase_price);
    const qty = Number(quantity) || 1;
    const effectiveTotalPrice = Number(total_price) || (effectiveUnitPrice * qty);
    const effectivePaidAmount = paid_amount !== undefined ? Number(paid_amount) : effectiveTotalPrice;
    const effectiveDebt = debt_amount !== undefined ? Number(debt_amount) : Math.max(0, effectiveTotalPrice - effectivePaidAmount);
    const profit = (effectiveUnitPrice - effectivePurchasePrice) * qty;
    
    const determinedStatus = (effectiveDebt > 0 && (status === 'yetkazildi' || status === 'yangi')) ? (status === 'yetkazildi' ? 'qarzda' : status) : status;

    const transaction = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO orders (
          product_id, platform, quantity, unit_price, total_price, profit,
          paid_amount, debt_amount, customer_name, customer_phone,
          delivery_address, delivery_fee, status, order_date, note
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        product_id,
        platform,
        qty,
        effectiveUnitPrice,
        effectiveTotalPrice,
        profit,
        effectivePaidAmount,
        effectiveDebt,
        customer_name,
        customer_phone,
        delivery_address,
        Number(delivery_fee) || 0,
        determinedStatus,
        order_date || null,
        note
      );
      
      db.prepare('UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = datetime("now", "localtime") WHERE id = ?').run(qty, product_id);
      
      return result.lastInsertRowid;
    });

    const orderId = transaction();
    res.status(201).json({ id: orderId, message: 'Buyurtma muvaffaqiyatli qoshildi!' });
  } catch (error) {
    console.error('Order POST error:', error);
    res.status(500).json({ error: 'Server xatosi yuz berdi: ' + error.message });
  }
});

// Qarzni to'lash (qarzni yopish)
router.put('/:id/pay-debt', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { amount_paid } = req.body;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) return res.status(404).json({ error: 'Zakaz topilmadi' });

    const currentDebt = Number(order.debt_amount) || 0;
    const payment = amount_paid !== undefined ? Number(amount_paid) : currentDebt;
    const newDebt = Math.max(0, currentDebt - payment);
    const newPaid = (Number(order.paid_amount) || 0) + payment;
    const newStatus = newDebt === 0 ? 'yetkazildi' : 'qarzda';

    const stmt = db.prepare(`
      UPDATE orders 
      SET paid_amount = ?, debt_amount = ?, status = ?
      WHERE id = ?
    `);
    stmt.run(newPaid, newDebt, newStatus, id);

    res.json({ message: 'Qarz to\'lovi qabul qilindi!', newDebt, newPaid, status: newStatus });
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.put('/:id/status', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { status } = req.body;
    
    const stmt = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
    const result = stmt.run(status, id);
    
    if (result.changes === 0) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    
    res.json({ message: 'Buyurtma holati yangilandi' });
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    
    const order = db.prepare('SELECT product_id, quantity FROM orders WHERE id = ?').get(id);
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM orders WHERE id = ?').run(id);
      db.prepare('UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = datetime("now", "localtime") WHERE id = ?').run(order.quantity, order.product_id);
    });
    
    transaction();
    res.json({ message: 'Buyurtma o\'chirildi va tovar qoldig\'i qaytarildi' });
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

export default router;

