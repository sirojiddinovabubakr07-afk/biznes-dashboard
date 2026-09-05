import express from 'express';
import multer from 'multer';
import path from 'path';
import { getDb } from '../database/db.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/products/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { search } = req.query;
    
    let query = 'SELECT * FROM products WHERE is_active = 1';
    let params = [];
    
    if (search) {
      query += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }
    
    query += ' ORDER BY created_at DESC';
    const products = db.prepare(query).all(...params);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
    
    const orderStats = db.prepare('SELECT platform, COUNT(*) as order_count, SUM(quantity) as total_sold FROM orders WHERE product_id = ? GROUP BY platform').all(id);
    
    res.json({ product, orderStats });
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.post('/', upload.single('image'), (req, res) => {
  try {
    const db = getDb();
    const { name, description, category, purchase_price, selling_price, stock_quantity } = req.body;
    const image_url = req.file ? `/uploads/products/${req.file.filename}` : null;
    
    const stmt = db.prepare(`
      INSERT INTO products (name, description, category, purchase_price, selling_price, stock_quantity, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(name, description, category, purchase_price, selling_price, stock_quantity, image_url);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Mahsulot muvaffaqiyatli qoshildi' });
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.put('/:id', upload.single('image'), (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, description, category, purchase_price, selling_price, stock_quantity } = req.body;
    
    let stmt, params;
    
    if (req.file) {
      const image_url = `/uploads/products/${req.file.filename}`;
      stmt = db.prepare(`
        UPDATE products 
        SET name = ?, description = ?, category = ?, purchase_price = ?, selling_price = ?, stock_quantity = ?, image_url = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `);
      params = [name, description, category, purchase_price, selling_price, stock_quantity, image_url, id];
    } else {
      stmt = db.prepare(`
        UPDATE products 
        SET name = ?, description = ?, category = ?, purchase_price = ?, selling_price = ?, stock_quantity = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `);
      params = [name, description, category, purchase_price, selling_price, stock_quantity, id];
    }
    
    const result = stmt.run(...params);
    if (result.changes === 0) return res.status(404).json({ error: 'Mahsulot topilmadi' });
    
    res.json({ message: 'Mahsulot yangilandi' });
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    
    const stmt = db.prepare('UPDATE products SET is_active = 0, updated_at = datetime("now", "localtime") WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) return res.status(404).json({ error: 'Mahsulot topilmadi' });
    
    res.json({ message: 'Mahsulot ochirildi' });
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

export default router;
