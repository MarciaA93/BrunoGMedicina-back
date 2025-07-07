import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PrecioCurso from './models/PrecioCursos.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  console.log('Conectado a MongoDB');

  await PrecioCurso.deleteMany();

  await PrecioCurso.insertMany([
    { nombreCurso: 'Curso de Masaje TuiNa', price: 138 },
    { nombreCurso: 'Renueva tu SER - Sesión 1 a 1', price: 67 }
  ]);

  console.log('Precios de cursos insertados');
  process.exit();
}).catch(err => console.error(err));
