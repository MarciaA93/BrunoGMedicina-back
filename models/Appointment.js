import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  date: String,
  time: String,
  isBooked: { type: Boolean, default: false },
});

export default mongoose.model('Appointment', appointmentSchema);
