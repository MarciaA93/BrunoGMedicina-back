// routes/compra.routes.js
import dotenv from 'dotenv';
import express from 'express';
import Compra from '../models/Compra.js';
import nodemailer from 'nodemailer';


dotenv.config();

const router = express.Router();

// Función para enviar el email
const enviarEmailConfirmacion = async ({ nombre, email, producto }) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // o el proveedor que uses
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: `"Bruno Grattoni Medicina China" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Confirmación de compra',
    html: `
      <h3>Hola ${nombre} 👋</h3>
      <p>Gracias por tu compra del producto: <strong>${producto}</strong>.</p>
      <p>Nos estaremos contactando pronto con más detalles.</p>
      <br/>
      <p>🌸 Gracias por confiar en nuestro espacio 🙏</p>
    `,
  };

  console.log('📧 Enviando email a:', email);
  await transporter.sendMail(mailOptions);
};

console.log('🧪 EMAIL_FROM:', process.env.EMAIL_FROM);
console.log('🧪 EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ cargada' : '❌ vacía');

// Ruta para guardar la compra y enviar el email
router.post('/guardar-compra', async (req, res) => {
  try {
    const { nombre, email, producto, paypalDetails } = req.body;
    console.log('📥 Datos recibidos:', { nombre, email, producto });

    // Validación de email
    if (!email || !email.includes('@') || !email.includes('.')) {
      console.warn('⚠️ Email inválido recibido:', email);
      return res.status(400).json({ error: 'Dirección de email inválida' });
    }

    const precios = {
      curso: 138,
      sesion: 67,
    };

    const nuevaCompra = new Compra({
      nombre,
      email,
      producto,
      precio: precios[producto] || 0,
      descripcion: paypalDetails?.purchase_units?.[0]?.description || '',
      paypalDetails,
    });

    await nuevaCompra.save();

    // Enviar email de confirmación
    await enviarEmailConfirmacion({ nombre, email, producto });

    res.status(201).json({ message: 'Compra guardada y email enviado con éxito' });
  } catch (error) {
    console.error('❌ Error al guardar la compra o enviar el email:', error);
    res.status(500).json({ error: 'Error al guardar la compra o enviar el email' });
  }
});

// Obtener todas las compras (para el panel)
router.get('/', async (req, res) => {
  try {
    const compras = await Compra.find().sort({ fechaCompra: -1 }).limit(15);
    res.json(compras);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

