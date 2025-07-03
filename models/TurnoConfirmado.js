// models/TurnoConfirmado.js
import mongoose from 'mongoose';

const turnoConfirmadoSchema = new mongoose.Schema({
  nombre: String,
  email: String,
  producto: String,
  fechaCompra: Date,
  metodo: String,
  fecha: String,
  hora: String
});

export default mongoose.model('TurnoConfirmado', turnoConfirmadoSchema);