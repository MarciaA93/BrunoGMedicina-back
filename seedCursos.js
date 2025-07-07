import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PrecioCursos from './models/PrecioCursos.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  console.log('Conectado a MongoDB');

  await PrecioCursos.deleteMany();

  await PrecioCursos.insertMany([
    { nombreCurso: 'Curso de Masaje TuiNa', price: 138 },
    { nombreCurso: 'Renueva tu SER - Sesión 1 a 1', price: 67 }
  ]);

  console.log('Precios de cursos insertados');
  process.exit();
}).catch(err => console.error(err));
