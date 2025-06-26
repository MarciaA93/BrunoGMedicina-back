import express from 'express';
import Appointment from '../models/Appointment.js';

const router = express.Router();

// Obtener todos los turnos disponibles
router.get('/', async (req, res) => {
  const appointments = await Appointment.find();
  res.json(appointments);
});

// Crear un nuevo turno
router.post('/', async (req, res) => {
  const { date, time } = req.body;
  const newAppointment = new Appointment({ date, time });
  await newAppointment.save();
  res.status(201).json(newAppointment);
});

// Marcar turno como reservado
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const appointment = await Appointment.findByIdAndUpdate(id, { isBooked: true }, { new: true });
  res.json(appointment);
});

export default router;
