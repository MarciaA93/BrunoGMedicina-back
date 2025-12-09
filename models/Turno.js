// models/Turno.js
import mongoose from 'mongoose';

const turnoSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true // ← 🔥 clave única por fecha
  },
  timeSlots: [
    {
      time: {
        type: String,
        required: true
      },
      available: {
        type: Boolean,
        required: true
      }
    }
  ]
});

// 🔥 Asegura que nunca existan dos documentos con el mismo "date"
turnoSchema.index({ date: 1 }, { unique: true });

const Turno = mongoose.model('Turno', turnoSchema);

export default Turno;

