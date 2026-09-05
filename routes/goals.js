import express from 'express';
import { getDb } from '../database/db.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const goals = db.prepare('SELECT * FROM goals ORDER BY created_at DESC').all();
    res.json(goals);
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { title, target_amount, period, deadline } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO goals (title, target_amount, period, deadline)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(title, target_amount, period, deadline);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Maqsad muvaffaqiyatli qoshildi' });
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { title, target_amount, period, deadline, is_completed } = req.body;
    
    const stmt = db.prepare(`
      UPDATE goals 
      SET title = ?, target_amount = ?, period = ?, deadline = ?, is_completed = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(title, target_amount, period, deadline, is_completed, id);
    if (result.changes === 0) return res.status(404).json({ error: 'Maqsad topilmadi' });
    
    res.json({ message: 'Maqsad yangilandi' });
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.put('/:id/progress', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { current_amount } = req.body;
    
    const goal = db.prepare('SELECT target_amount FROM goals WHERE id = ?').get(id);
    if (!goal) return res.status(404).json({ error: 'Maqsad topilmadi' });
    
    const is_completed = current_amount >= goal.target_amount ? 1 : 0;
    
    const stmt = db.prepare('UPDATE goals SET current_amount = ?, is_completed = ? WHERE id = ?');
    const result = stmt.run(current_amount, is_completed, id);
    
    res.json({ message: 'Maqsad progressi yangilandi' });
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    
    const stmt = db.prepare('DELETE FROM goals WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) return res.status(404).json({ error: 'Maqsad topilmadi' });
    
    res.json({ message: 'Maqsad ochirildi' });
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

export default router;
