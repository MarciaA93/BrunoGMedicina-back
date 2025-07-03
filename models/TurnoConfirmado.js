// models/TurnoConfirmado.js
import mongoose from 'mongoose';

const turnoConfirmadoSchema = new mongoose.Schema({
  fecha: String,        // "2025-07-03"
  hora: String,         // "15:00"
  tipoMasaje: String,   // "TuiNa Premium", etc.
  metodoPago: String,   // "Mercado Pago"
  fechaCompra: { type: Date, default: Date.now },
});

export default mongoose.model('TurnoConfirmado', turnoConfirmadoSchema);