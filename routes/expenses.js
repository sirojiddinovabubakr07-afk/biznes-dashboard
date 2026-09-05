import express from 'express';
import multer from 'multer';
import path from 'path';
import { getDb } from '../database/db.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/receipts/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

function getPeriodCondition(period) {
  switch (period) {
    case '7d': return "expense_date >= date('now', '-7 days', 'localtime')";
    case '15d': return "expense_date >= date('now', '-15 days', 'localtime')";
    case '1m': return "expense_date >= date('now', '-1 month', 'localtime')";
    case '6m': return "expense_date >= date('now', '-6 months', 'localtime')";
    case '1y': return "expense_date >= date('now', '-1 year', 'localtime')";
    default: return "1=1";
  }
}

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { category, period } = req.query;
    
    let query = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    
    if (period) {
      query += ` AND ${getPeriodCondition(period)}`;
    }
    
    query += ' ORDER BY expense_date DESC';
    
    const expenses = db.prepare(query).all(...params);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const { period } = req.query;
    
    let condition = "1=1";
    if (period) {
      condition = getPeriodCondition(period);
    }
    
    const query = `
      SELECT category, COUNT(*) as expense_count, SUM(amount) as total_amount
      FROM expenses
      WHERE ${condition}
      GROUP BY category
    `;
    
    const stats = db.prepare(query).all();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.post('/', upload.single('receipt'), (req, res) => {
  try {
    const db = getDb();
    const { category, description, amount, location, expense_date } = req.body;
    const receipt_image = req.file ? `/uploads/receipts/${req.file.filename}` : null;
    const dateToUse = expense_date || new Date().toISOString().split('T')[0];
    
    const stmt = db.prepare(`
      INSERT INTO expenses (category, description, amount, receipt_image, location, expense_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(category, description, amount, receipt_image, location, dateToUse);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Xarajat muvaffaqiyatli qoshildi' });
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.put('/:id', upload.single('receipt'), (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { category, description, amount, location, expense_date } = req.body;
    
    let stmt, params;
    
    if (req.file) {
      const receipt_image = `/uploads/receipts/${req.file.filename}`;
      stmt = db.prepare(`
        UPDATE expenses 
        SET category = ?, description = ?, amount = ?, location = ?, expense_date = ?, receipt_image = ?
        WHERE id = ?
      `);
      params = [category, description, amount, location, expense_date, receipt_image, id];
    } else {
      stmt = db.prepare(`
        UPDATE expenses 
        SET category = ?, description = ?, amount = ?, location = ?, expense_date = ?
        WHERE id = ?
      `);
      params = [category, description, amount, location, expense_date, id];
    }
    
    const result = stmt.run(...params);
    if (result.changes === 0) return res.status(404).json({ error: 'Xarajat topilmadi' });
    
    res.json({ message: 'Xarajat yangilandi' });
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    
    const stmt = db.prepare('DELETE FROM expenses WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) return res.status(404).json({ error: 'Xarajat topilmadi' });
    
    res.json({ message: 'Xarajat ochirildi' });
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

export default router;
