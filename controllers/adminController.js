// controllers/adminController.js
import Admin from '../models/Admin.js';
import bcrypt from 'bcryptjs';

export const loginAdmin = async (req, res) => {
  const { username, password } = req.body;

  try {
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: 'Usuario incorrecto' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    // Si querés usar JWT también podríamos hacerlo, pero por ahora simple:
    res.json({ message: 'Login exitoso', username: admin.username });
  } catch (error) {
    res.status(500).json({ message: 'Error al iniciar sesión', error });
  }
};
