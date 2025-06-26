import mongoose from 'mongoose';

const turnoSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
  },
  timeSlots: [
    {
      time: String,
      available: Boolean,
    },
  ],
});

const Turno = mongoose.model('Turno', turnoSchema);
export default Turno;
