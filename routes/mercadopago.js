// routes/mercadopago.js
import express from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});


const preference = new Preference(client);

const result = await preference.create({
  body: {
    items: [{
      title: String(title),
      unit_price: Number(unit_price),
      quantity: Number(quantity),
      currency_id: 'ARS'
    }],
    payer: {
      email: String(email),
    },
    back_urls: {
      success: "https://brunomtch.com/success",
      failure: "https://brunomtch.com/failure",
      pending: "https://brunomtch.com/pending"
    },
    auto_return: "approved",
    notification_url: "https://brunogmedicina-back-production.up.railway.app/api/mercadopago/webhook",
    metadata: {
      nombre: String(nombre),
      email: String(email),
      tipo: String(title),
      date: String(date),
      time: String(time)
    }
  }
});

export default router;
