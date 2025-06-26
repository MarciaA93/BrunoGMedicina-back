import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import Admin from './models/Admin.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('MongoDB conectado');

  const hashedPassword = await bcrypt.hash('MyWeb93', 10);

  await Admin.findOneAndUpdate(
    { username: 'BrunoG33' },
    { password: hashedPassword },
    { upsert: true }
  );

  console.log('✅ Admin actualizado/creado con éxito');
  process.exit();
})
.catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});



