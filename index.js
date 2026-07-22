const express = require('express');
const twilio = require('twilio');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// CONFIGURACIÓN GENERAL
// ============================================================
const BASE_URL = 'https://biobot-six.vercel.app';
const VOICE = { language: 'es-MX', voice: 'es-MX-Standard-A' };
const TWILIO_CALLER_ID = '+18312825317';
const ADVISOR_NUMBER = process.env.ADVISOR_PHONE_NUMBER || '+528144384806';

function say(text) {
  return `<Say language="${VOICE.language}" voice="${VOICE.voice}">${text}</Say>`;
}

function xml(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${body}\n</Response>`;
}

function fullUrl(path, params) {
  let url = `${BASE_URL}${path}`;
  if (params) {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&amp;');
    if (query) url += `?${query}`;
  }
  return url;
}

function redirectTo(path, params) {
  return `<Redirect method="GET">${fullUrl(path, params)}</Redirect>`;
}

// ============================================================
// RUTA PRINCIPAL
// ============================================================
app.get('/', (req, res) => {
  return res.status(200).send('Servidor BioMey Activo en Vercel');
});

// ============================================================
// 🔥 ENDPOINT: LLAMAR AL CLIENTE
// ============================================================
app.get('/make-call', async (req, res) => {
  const envAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const envAuthToken = process.env.TWILIO_AUTH_TOKEN;

  if (!envAccountSid || !envAuthToken) {
    return res.status(500).json({ status: 'error', message: 'Variables de entorno faltantes en Vercel.' });
  }

  const clientPhone = req.query.clientPhone;
  const producerPhone = req.query.producerPhone;
  const producerName = req.query.producerName || 'Productor';

  if (!clientPhone) {
    return res.status(400).json({ status: 'error', message: 'Se requiere el número del cliente (clientPhone).' });
  }

  if (!producerPhone) {
    return res.status(400).json({ status: 'error', message: 'Se requiere el número del productor (producerPhone).' });
  }

  try {
    const secureClient = twilio(envAccountSid.trim(), envAuthToken.trim());
    
    // ✅ LLAMAR AL CLIENTE (no al productor)
    const call = await secureClient.calls.create({
      url: `${BASE_URL}/voice/with-producer?producerPhone=${encodeURIComponent(producerPhone)}&producerName=${encodeURIComponent(producerName)}`,
      method: 'GET',
      to: clientPhone,  // ✅ Cliente recibe la llamada
      from: TWILIO_CALLER_ID,
    });
    
    return res.json({ 
      status: 'success', 
      message: 'Llamada iniciada al cliente', 
      callSid: call.sid 
    });
  } catch (error) {
    console.error('Error al iniciar llamada:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// ============================================================
// 🔥 MENÚ PARA EL CLIENTE
// ============================================================
app.get('/voice/with-producer', (req, res) => {
  res.type('text/xml');
  const producerPhone = req.query.producerPhone || '+528144384806';
  const producerName = req.query.producerName || 'Productor';

  const menu = 
    `Bienvenido a BioMey. Has solicitado contactar a ${producerName}. ` +
    `Presiona 1 para hablar directamente con el productor. ` +
    `Presiona 2 para recibir información sobre servicios. ` +
    `Presiona 0 para hablar con un asesor.`;

  const body = `
    <Gather input="dtmf" numDigits="1" timeout="6" action="${fullUrl('/manejar-llamada-productor', { producerPhone, producerName })}" method="GET">
        ${say(menu)}
    </Gather>
    ${say('No recibimos tu respuesta. Gracias por contactar a BioMey.')}
    <Hangup/>`;

  return res.status(200).send(xml(body));
});

// ============================================================
// 🔥 TRANSFERIR AL PRODUCTOR O ASESOR
// ============================================================
app.get('/manejar-llamada-productor', (req, res) => {
  res.type('text/xml');
  const digit = req.query?.Digits;
  const producerPhone = req.query?.producerPhone || '+528144384806';
  const producerName = req.query?.producerName || 'Productor';

  if (digit === '1') {
    // ✅ Transferir al productor
    const body = 
      say(`Conectando con ${producerName}, un momento por favor.`) +
      `<Dial timeout="20" callerId="${TWILIO_CALLER_ID}" action="${BASE_URL}/despues-de-llamada" method="GET">${producerPhone}</Dial>`;
    return res.status(200).send(xml(body));
  }

  if (digit === '2') {
    const body = 
      say('Gracias por tu interés en BioMey. Nuestros servicios incluyen páginas web, mantenimiento de computadoras y soporte técnico.') +
      say('¿Te gustaría hablar con un asesor? Presiona 1 para sí, presiona 2 para finalizar.') +
      `<Gather input="dtmf" numDigits="1" timeout="6" action="${fullUrl('/manejar-asesor-llamada')}" method="GET">
          ${say('Presiona 1 para hablar con un asesor, o 2 para finalizar.')}
      </Gather>`;
    return res.status(200).send(xml(body));
  }

  if (digit === '0') {
    const body = 
      say('Te comunico con un asesor, un momento por favor.') +
      `<Dial timeout="20" callerId="${TWILIO_CALLER_ID}" action="${BASE_URL}/despues-de-llamada" method="GET">${ADVISOR_NUMBER}</Dial>`;
    return res.status(200).send(xml(body));
  }

  const body = 
    say('No reconocimos tu opción.') +
    redirectTo('/voice/with-producer', { producerPhone, producerName });
  return res.status(200).send(xml(body));
});

// ============================================================
// 🔥 DESPUÉS DE LA LLAMADA
// ============================================================
app.get('/despues-de-llamada', (req, res) => {
  res.type('text/xml');
  const status = req.query?.DialCallStatus;

  if (status === 'completed' || status === 'answered') {
    const body = say('La llamada ha finalizado. Gracias por usar BioMey. Que tengas excelente día.') + '<Hangup/>';
    return res.status(200).send(xml(body));
  }

  const body = 
    say('No se pudo completar la llamada. Por favor intenta de nuevo más tarde.') + '<Hangup/>';
  return res.status(200).send(xml(body));
});

// ============================================================
// 🔥 MANEJAR ASESOR
// ============================================================
app.get('/manejar-asesor-llamada', (req, res) => {
  res.type('text/xml');
  const digit = req.query?.Digits;

  if (digit === '1') {
    const body = 
      say('Te comunico con un asesor, un momento por favor.') +
      `<Dial timeout="20" callerId="${TWILIO_CALLER_ID}" action="${BASE_URL}/despues-de-llamada" method="GET">${ADVISOR_NUMBER}</Dial>`;
    return res.status(200).send(xml(body));
  }

  const body = say('Gracias por llamar a BioMey. Que tengas excelente día.') + '<Hangup/>';
  return res.status(200).send(xml(body));
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
  console.error('Error no controlado en el bot:', err);
  res.type('text/xml');
  return res.status(200).send(
    xml(say('Ocurrió un problema técnico. Por favor intenta llamar de nuevo en unos minutos. Gracias por tu paciencia.') + '<Hangup/>')
  );
});

module.exports = app;