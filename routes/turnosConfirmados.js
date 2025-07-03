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
await TurnoConfirmado.create({
  fecha: date,
  hora: time,
  tipoMasaje: req.body.title || 'No especificado',
  metodoPago: 'Mercado Pago',
});

export default router;