// server/models/AppointmentSlot.js
import mongoose from 'mongoose';

const appointmentSlotSchema = new mongoose.Schema({
  date: {
    type: String, // Puede ser "2025-05-21"
    required: true,
  },
  timeSlots: [
    {
      time: String, // Ejemplo: "10:00"
      available: {
        type: Boolean,
        default: true,
      },
    },
  ],
});

export default mongoose.model('AppointmentSlot', appointmentSlotSchema);
