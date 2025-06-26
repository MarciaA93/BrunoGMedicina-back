// server/routes/appointmentRoutes.js
import express from 'express';
import AppointmentSlot from '../models/AppointmentSlot.js';

const router = express.Router();

// 🔹 Obtener todos los días con sus horarios
router.get('/', async (req, res) => {
  try {
    const slots = await AppointmentSlot.find();
    res.json(slots);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los turnos' });
  }
});

// 🔹 Crear o actualizar turnos para un día específico
router.post('/', async (req, res) => {
  const { date, timeSlots } = req.body;
  try {
    const existing = await AppointmentSlot.findOne({ date });

    if (existing) {
      existing.timeSlots = timeSlots;
      await existing.save();
      res.json({ message: 'Turnos actualizados' });
    } else {
      const newSlot = new AppointmentSlot({ date, timeSlots });
      await newSlot.save();
      res.json({ message: 'Turnos creados' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar los turnos' });
  }
});

// 🔹 Reservar un turno (marcar como no disponible)
router.put('/:date/:time', async (req, res) => {
  const { date, time } = req.params;
  try {
    const slot = await AppointmentSlot.findOne({ date });

    if (!slot) return res.status(404).json({ message: 'Día no encontrado' });

    const timeSlot = slot.timeSlots.find(t => t.time === time);
    if (timeSlot) {
      timeSlot.available = false;
      await slot.save();
      res.json({ message: 'Turno reservado' });
    } else {
      res.status(404).json({ message: 'Horario no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error al reservar el turno' });
  }
});

export default router;
