// models/Compra.js
import mongoose from 'mongoose';

const compraSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true },
  producto: { type: String, required: true },
  precio: { type: Number, required: true },
  descripcion: String,
  paypalDetails: Object, // Guarda la respuesta completa de PayPal si querés
  fechaCompra: { type: Date, default: Date.now },
});

export default mongoose.model('Compra', compraSchema);