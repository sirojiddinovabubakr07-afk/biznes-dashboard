import express from 'express';

const router = express.Router();

router.post('/verify', (req, res) => {
  try {
    const { code } = req.body;
    
    if (code === '7770') {
      return res.json({ role: 'admin', message: 'Tizimga muvaffaqiyatli kirdingiz' });
    } else if (code === '1014') {
      return res.json({ role: 'family', message: 'Tizimga muvaffaqiyatli kirdingiz' });
    } else {
      return res.status(401).json({ error: 'Xato kod kiritildi' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server xatosi yuz berdi' });
  }
});

export default router;
