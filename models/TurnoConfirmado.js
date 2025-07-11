// models/TurnoConfirmado.js
import mongoose from 'mongoose';

const turnoConfirmadoSchema = new mongoose.Schema({
  nombre: String,
  email: String,
  tipo: String, // ← este campo ahora se llama tipo, no producto
  date: String, // ← ahora coincide con metadata.date
  time: String, // ← ahora coincide con metadata.time
  fechaCompra: Date,
  metodo: String
});

export default mongoose.model('TurnoConfirmado', turnoConfirmadoSchema);