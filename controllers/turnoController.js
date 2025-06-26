import Turno from '../models/Turno.js';

// Crear un nuevo turno (día con horarios disponibles)
export const crearTurno = async (req, res) => {
  try {
    const { date, timeSlots } = req.body;

    if (!date || !timeSlots || !Array.isArray(timeSlots)) {
      return res.status(400).json({ message: 'Datos inválidos. Se requiere "date" y "slots" (array).' });
    }

    const nuevoTurno = new Turno({ date, timeSlots });
    await nuevoTurno.save();

    res.status(201).json(nuevoTurno);
  } catch (error) {
    console.error('Error al crear turno:', error);
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

    if (!slot || !slot.available) {
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
