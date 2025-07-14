// server/routes/price.routes.js
import express from 'express';
import Price from '../models/Price.js';
const router = express.Router();

router.get('/', async (req, res) => {
  res.json(await Price.find());
});
router.put('/:tipo', async (req, res) => {
  const { price } = req.body;
  const updated = await Price.findOneAndUpdate(
    { masajeType: req.params.tipo },
    { price, price2  },
    { new: true, upsert: true }
  );
  res.json(updated);
});
export default router;
