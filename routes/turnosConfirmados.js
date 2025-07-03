import express from 'express';
import TurnoConfirmado from '../models/TurnoConfirmado.js';

const router = express.Router();

// Obtener todos los turnos confirmados
router.get('/', async (req, res) => {
  try {
    const confirmados = await TurnoConfirmado.find().sort({ fechaCompra: -1 });
    res.json(confirmados);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar turno confirmado
router.post('/', async (req, res) => {
  const { nombre, email, producto, fecha, hora } = req.body;

  if (!nombre || !email || !producto || !fecha || !hora) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    const nuevo = new TurnoConfirmado({
      nombre,
      email,
      producto,
      fecha,
      hora,
      fechaCompra: new Date(),
      metodo: 'Mercado Pago',
    });

    await nuevo.save();
    res.status(201).json({ message: 'Turno confirmado guardado', turno: nuevo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
