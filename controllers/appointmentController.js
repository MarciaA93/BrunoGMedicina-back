import Appointment from '../models/Appointment.js';

// Crear una cita nueva
export const crearAppointment = async (req, res) => {
  try {
    const { date, time, clientName, service } = req.body;

    // Validar que venga la data mínima
    if (!date || !time || !clientName) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    // Crear nueva cita
    const appointment = new Appointment({ date, time, clientName, service });
    await appointment.save();

    res.status(201).json({ message: 'Cita creada', appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener todas las citas
export const obtenerAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find();
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar una cita (por ID)
export const actualizarAppointment = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const appointment = await Appointment.findByIdAndUpdate(id, updates, { new: true });

    if (!appointment) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    res.json({ message: 'Cita actualizada', appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar una cita (por ID)
export const eliminarAppointment = async (req, res) => {
  const { id } = req.params;

  try {
    const appointment = await Appointment.findByIdAndDelete(id);

    if (!appointment) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    res.json({ message: 'Cita eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
