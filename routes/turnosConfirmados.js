import express from 'express';
import TurnoConfirmado from '../models/TurnoConfirmado.js';
import nodemailer from 'nodemailer';

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
  const { nombre, email, tipo, date, time } = req.body;

  if (!nombre || !email || !tipo || !date || !time) {
  return res.status(400).json({ error: 'Faltan datos obligatorios' });
}

  try {
   const nuevo = new TurnoConfirmado({
  nombre,
  email,
  producto: tipo,
  fecha: date,
  hora: time,
  fechaCompra: new Date(),
  metodo: 'Mercado Pago',
});

    await nuevo.save();
// Configura tu transporte de correo (ejemplo con Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_FROM,     // ejemplo: brunogmedicina@gmail.com
    pass: process.env.EMAIL_PASSWORD,     // app password, no tu contraseña real
  },
});

// Email al cliente
await transporter.sendMail({
  from: `"Bruno G Medicina China" <${process.env.EMAIL_FROM}>`,
  to: email,
  subject: 'Confirmación de tu turno',
  html: `
    <p>Hola ${nombre},</p>
    <p>Tu turno fue confirmado para el día <strong>${date}</strong> a las <strong>${time}</strong>.</p>
    <p>Tipo de masaje: <strong>${tipo}</strong></p>
    <p>Gracias por confiar en nosotros 🙌</p>
  `,
});

// Email al masajista
await transporter.sendMail({
  from: `"Bruno G Medicina China" <${process.env.EMAIL_FROM}>`,
  to: process.env.EMAIL_FROM, // puede ser tu correo personal
  subject: 'Nuevo turno confirmado',
  html: `
    <p>Nuevo turno confirmado:</p>
    <ul>
      <li><strong>Nombre:</strong> ${nombre}</li>
      <li><strong>Email:</strong> ${email}</li>
      <li><strong>Tipo:</strong> ${tipo}</li>
      <li><strong>Fecha:</strong> ${date}</li>
      <li><strong>Hora:</strong> ${time}</li>
    </ul>
  `,
});


    res.status(201).json({ message: 'Turno confirmado guardado', turno: nuevo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
