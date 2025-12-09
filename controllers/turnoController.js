import Turno from '../models/Turno.js';
import TurnoConfirmado from '../models/TurnoConfirmado.js';

// Crear un nuevo turno (día con horarios disponibles)
export const crearTurno = async (req, res) => {
  try {
    const { date, timeSlots } = req.body;

    if (!date || !timeSlots || !Array.isArray(timeSlots)) {
      return res.status(400).json({ message: 'Datos inválidos. Se requiere "date" y "slots" (array).' });
    }

    // 🔥 FIX 1 — Si ya existe, NO creamos duplicado (índice único)
    const existente = await Turno.findOne({ date });
    if (existente) {
      return res.status(400).json({ message: 'Ya existe un turno para esa fecha. Use actualización en su lugar.' });
    }

    // 🔥 FIX 2 — No permitir reabrir horarios confirmados (protección absoluta)
    const timeSlotsProtegidos = timeSlots.map(slot => ({
      time: slot.time,
      available: true
    }));

    const nuevoTurno = new Turno({ date, timeSlots: timeSlotsProtegidos });
    await nuevoTurno.save();

    res.status(201).json(nuevoTurno);

  } catch (error) {
    console.error('Error al crear turno:', error);

    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ya existe un turno para esa fecha (duplicado).' });
    }

    res.status(500).json({ message: 'Error del servidor al crear el turno' });
  }
};

// Obtener todos los turnos
export const obtenerTurnos = async (req, res) => {
  try {
    const turnos = await Turno.find();
    res.json(turnos);
  } catch (error) {
    console.error('Error al obtener turnos:', error);
    res.status(500).json({ message: 'Error del servidor al obtener turnos' });
  }
};

// Reservar un horario específico
export const reservarHorario = async (req, res) => {
  try {
    const { date, time } = req.body;

    if (!date || !time) {
      return res.status(400).json({ message: 'Se requieren "date" y "time".' });
    }

    const turno = await Turno.findOne({ date });

    if (!turno) {
      return res.status(404).json({ message: 'No se encontró un turno para esa fecha.' });
    }

    const slot = turno.timeSlots.find((slot) => slot.time === time);
    if (!slot) {
      return res.status(404).json({ message: 'Horario no encontrado.' });
    }

    // 🔥 FIX 3 — Impedir reservar si ya hay un TurnoConfirmado
    const yaConfirmado = await TurnoConfirmado.findOne({ date, time });
    if (yaConfirmado) {
      return res.status(400).json({ message: 'Ese horario ya fue reservado y confirmado.' });
    }

    // 🔥 FIX 4 — Impedir reservar si already false
    if (!slot.available) {
      return res.status(400).json({ message: 'Horario no disponible.' });
    }

    slot.available = false;
    await turno.save();

    res.status(200).json({ message: 'Horario reservado con éxito', turno });

  } catch (error) {
    console.error('Error al reservar horario:', error);
    res.status(500).json({ message: 'Error del servidor al reservar horario' });
  }
};

export const recibirWebhook = async (req, res) => {
  console.log("📩 Webhook recibido:", req.body);
  res.sendStatus(200);
};
