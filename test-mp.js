import mercadopago from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

async function test() {
  try {
    const user = await mercadopago.users.getCurrentUser();
    console.log('Usuario Mercado Pago:', user);
  } catch (err) {
    console.error('Error test Mercado Pago:', err);
  }
}

test();

