// models/TurnoConfirmado.js
import mongoose from 'mongoose';

const turnoConfirmadoSchema = new mongoose.Schema({
  nombre: String,
  email: String,
  tipo: String,
  date: String,
  time: String,
  fechaCompra: Date,
  metodo: String,
  paymentId: {
    type: String,
    required: true
  }
});

// 🔥 Clave única: evita duplicados para el mismo turno
turnoConfirmadoSchema.index({ date: 1, time: 1 }, { unique: true });

// 🔥 Clave única: evita procesar un payment más de una vez
turnoConfirmadoSchema.index({ paymentId: 1 }, { unique: true });

export default mongoose.model('TurnoConfirmado', turnoConfirmadoSchema);
