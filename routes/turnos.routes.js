import express from 'express';
import Turno from '../models/Turno.js';
import { crearTurno, obtenerTurnos, reservarHorario } from '../controllers/turnoController.js';

const router = express.Router();

// Crear o actualizar turnos (día con horarios)
router.post('/', async (req, res) => {
  const { date, timeSlots } = req.body;
  
  try {
    let turno = await Turno.findOne({ date });

    if (turno) {
      turno.timeSlots = timeSlots;
      await turno.save();
      res.json({ message: 'Turnos actualizados', turno });
    } else {
      turno = new Turno({ date, timeSlots });
      await turno.save();
      res.json({ message: 'Turnos creados', turno });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todos los turnos
router.get('/', async (req, res) => {
  try {
    const turnos = await Turno.find();
    res.json(turnos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reservar un turno (poner "available: false")
router.put('/:date/:time', async (req, res) => {
  const { date, time } = req.params;
  try {
    const turno = await Turno.findOne({ date });
    if (!turno) {
      return res.status(404).json({ error: 'Día no encontrado' });
    }

    const slot = turno.timeSlots.find((s) => s.time === time);
    if (!slot) {
      return res.status(404).json({ error: 'Horario no encontrado' });
    }

    if (!slot.available) {
      return res.status(400).json({ error: 'Turno ya reservado' });
    }

    slot.available = false;
    await turno.save();
    res.json({ message: 'Turno reservado', turno });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
