import express from 'express';
import Precio from '../models/Precio.js';

const router = express.Router();

// GET /api/precios - Obtener todos los precios
router.get('/', async (req, res) => {
  try {
    const precios = await Precio.find();
    res.json(precios);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener precios' });
  }
});

// PUT /api/precios/:tipo - Actualizar el precio de un masaje
router.put('/:tipo', async (req, res) => {
  const { tipo } = req.params;
    const { price, price2 } = req.body;

  try {
    const updated = await Precio.findOneAndUpdate(
      { masajeType: tipo },
      { price, price2 },
      { new: true, upsert: true } // upsert crea si no existe
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar precio' });
  }
});

// (Opcional) POST /api/precios - Crear nuevo precio (solo la primera vez)
router.post('/', async (req, res) => {
  const { masajeType, price } = req.body;

  try {
    const nuevo = new Precio({ masajeType, price });
    await nuevo.save();
    res.status(201).json(nuevo);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear precio' });
  }
});

export default router;
