import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TurnoConfirmado from './models/TurnoConfirmado.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('🟢 Conectado a MongoDB');

    const testTurno = new TurnoConfirmado({
      nombre: "Test de creación",
      email: "test@ejemplo.com",
      producto: "Masaje Test",
      fechaCompra: new Date(),
      metodo: "Test Manual",
      fecha: "2025-07-11",
      hora: "12:00"
    });

    await testTurno.save();
    console.log("✅ Turno guardado correctamente");

    mongoose.connection.close();
  })
  .catch(err => {
    console.error('❌ Error al conectar o guardar:', err);
    mongoose.connection.close();
  });
