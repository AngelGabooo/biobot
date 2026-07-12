const express = require('express');
const twilio = require('twilio');
const cors = require('cors');
const { Resend } = require('resend');
const { GoogleGenAI } = require('@google/genai');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicialización de servicios externos
const resend = new Resend(process.env.RESEND_API_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const companyInfo = {
  name: 'BioMey',
  description: 'Somos una agencia de soluciones digitales especializada en desarrollo web, aplicaciones móviles y servicios tecnológicos.',
  phone: '33 4981 2319',
  email: 'soporte-biomey-tux@outlook.com',
  website: 'https://bio-mey-com-five.vercel.app/'
};

const services = {
  landing: { name: 'Landing Page', prices: '2,500 pesos', basePrice: 2500 },
  negocios: { name: 'Página Web para Negocios', prices: '6,500 pesos', basePrice: 6500 },
  profesional: { name: 'Página Web Profesional', prices: '11,500 pesos', basePrice: 11500 },
  empresarial: { name: 'Página Web Empresarial', prices: '18,500 pesos', basePrice: 18500 },
  ecommerce: { name: 'Tienda en Línea o E-commerce', prices: 'desde 15,000 pesos', basePrice: 15000 },
  mantenimiento_preventivo: { name: 'Mantenimiento Preventivo de PC', prices: 'desde 250 pesos', basePrice: 250 },
  mantenimiento_correctivo: { name: 'Mantenimiento Correctivo de PC', prices: 'depende del diagnóstico', basePrice: 0 },
  software: { name: 'Instalación y Configuración de Software', prices: 'bajo cotización', basePrice: 0 },
  redes: { name: 'Soporte de Redes e Internet', prices: 'bajo cotización', basePrice: 0 }
};

const BASE_URL = 'https://biobot-six.vercel.app';
const VOICE = { language: 'es-MX', voice: 'es-MX-Standard-A' };

const AVISO_LEGAL =
  'Antes de continuar, te informamos que esta llamada está siendo monitoreada con fines de calidad. ' +
  'Recuerda que estás utilizando la versión beta de prueba de nuestro asistente virtual BioMey. ';

function say(text) {
  return `<Say language="${VOICE.language}" voice="${VOICE.voice}">${text}</Say>`;
}

function xml(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${body}\n</Response>`;
}

// RUTA RAÍZ
app.get('/', (req, res) => {
  return res.status(200).send('Servidor BioMey Activo en Vercel');
});

// ============================================================
// 1. BIENVENIDA Y CAPTURA NATURAL DE VOZ
// ============================================================
app.get('/voice', (req, res) => {
  res.type('text/xml');
  const saludo = 'Bienvenido a BioMey, tu agencia de soluciones digitales. Cuéntame con qué servicio o problema de software o páginas web te podemos ayudar hoy.';
  
  const body = `
    <Gather input="speech" timeout="5" speechTimeout="auto" action="${BASE_URL}/process-ai" method="POST" language="es-MX">
        ${say(AVISO_LEGAL + saludo)}
    </Gather>
    ${say('No logré escucharte. Puedes llamarnos de nuevo cuando gustes.')}
    <Hangup/>
  `;
  return res.status(200).send(xml(body));
});

// ============================================================
// 2. MOTOR DE CONVERSACIÓN NATURAL CON GEMINI
// ============================================================
app.post('/process-ai', async (req, res) => {
  res.type('text/xml');
  const speechResult = req.body?.SpeechResult || '';
  const clientPhone = req.body?.From || 'Desconocido';

  if (!speechResult) {
    return res.status(200).send(xml(`${say('No te escuché bien.')}<Redirect method="GET">${BASE_URL}/voice</Redirect>`));
  }

  try {
    // Prompt estructurado para forzar a Gemini a devolver una respuesta JSON limpia
    const systemInstruction = `
      Eres el asistente de voz IA de la empresa BioMey. Tu trabajo es escuchar lo que dice el cliente y responderle con amabilidad, fluidez y brevedad (máximo 2 oraciones por voz).
      Analiza el texto y clasifícalo en base a este catálogo: ${JSON.stringify(services)}.
      Debes devolver ÚNICAMENTE un objeto JSON estructurado con el siguiente formato:
      {
        "reply": "Tu respuesta hablada para el cliente explicando brevemente el servicio y su costo.",
        "detectedKey": "La clave del servicio detectado (ej: 'landing', 'mantenimiento_correctivo', etc. o 'none' si es genérico)",
        "isUrgent": true/false (pon true si el cliente está desesperado, menciona urgencia, caída de sistema o pérdida de datos)
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash', // Actualizamos a la versión más reciente y activa de la API
      contents: speechResult,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json'
      }
    });

    const aiData = JSON.parse(response.text.trim());
    
    // Si se detecta urgencia crítica ("no prende", "perdí datos"), enviamos alerta inmediata y/o transferimos
    if (aiData.isUrgent) {
      // Enviar email de urgencia en segundo plano
      enviarEmailReporte(clientPhone, aiData.detectedKey, speechResult, 'CRÍTICA / URGENTE');
      
      const bodyUrgente = `
        ${say('Detecto que esto es urgente. ' + aiData.reply + ' Espera un segundo en la línea mientras intento enlazar tu llamada con un ingeniero de soporte.')}
        <!-- Coloca tu número de celular real aquí abajo si deseas transferir llamadas críticas en vivo -->
        <!-- <Dial>+528144384806</Dial> -->
        <Hangup/>
      `;
      return res.status(200).send(xml(bodyUrgente));
    }

    // --- COTIZACIÓN DINÁMICA POR DTMF ---
    // Si el cliente está cotizando páginas web avanzadas o e-commerce, hacemos preguntas interactivas
    if (aiData.detectedKey === 'ecommerce' || aiData.detectedKey === 'profesional') {
      const bodyMenuDinámico = `
        ${say(aiData.reply)}
        <Gather input="dtmf" numDigits="1" timeout="5" action="${BASE_URL}/cotizacion-dinamica?key=${aiData.detectedKey}&amp;speech=${encodeURIComponent(speechResult)}" method="POST">
            ${say('Para darte un precio más preciso en este instante, por favor presiona 1 si requieres integración de cobros con tarjetas en línea, o presiona 2 si solo requieres un catálogo informativo.')}
        </Gather>
        ${say('Entendido, analizaremos tu caso.')}
        <Redirect method="POST">${BASE_URL}/finalizar-llamada?key=${aiData.detectedKey}&amp;speech=${encodeURIComponent(speechResult)}</Redirect>
      `;
      return res.status(200).send(xml(bodyMenuDinámico));
    }

    // Flujo normal para otros servicios detectados
    enviarEmailReporte(clientPhone, aiData.detectedKey, speechResult, 'Normal');
    
    const bodyNormal = `
      ${say(aiData.reply + ' Alguien de nuestro equipo te contactará de inmediato en este número telefónico.')}
      <Hangup/>
    `;
    return res.status(200).send(xml(bodyNormal));

  } catch (error) {
    // Imprime el error completo con propiedades internas para debug en Vercel Logs
    console.error('Error detallado en Gemini Engine:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    return res.status(200).send(xml(`${say('Entendido. Registramos tu solicitud. Un asesor se comunicará contigo.')}<Hangup/>`));
  }
});

// ============================================================
// 3. PROCESAMIENTO DE COTIZACIÓN DINÁMICA (DTMF)
// ============================================================
app.post('/cotizacion-dinamica', async (req, res) => {
  res.type('text/xml');
  const digit = req.body?.Digits;
  const key = req.query?.key;
  const originalSpeech = req.query?.speech || '';
  const clientPhone = req.body?.From || 'Desconocido';

  let precioCalculado = services[key]?.basePrice || 0;
  let detalleExtra = '';

  if (digit === '1') {
    precioCalculado += 8000; // Costo extra por pasarelas de pago
    detalleExtra = 'Con pasarela de pagos integrada (Tarjetas/PayPal).';
  } else {
    detalleExtra = 'Solo catálogo / informativo.';
  }

  // Enviar email con los datos dinámicos extraídos del teclado
  enviarEmailReporte(clientPhone, key, `${originalSpeech} | Opcion DTMF: ${detalleExtra}`, `Cotización Especial: $${precioCalculado} MXN`);

  const mensajeCotizacion = `Perfecto. Con esa opción el costo estimado aproximado sería de ${precioCalculado} pesos. Un especialista de BioMey te contactará en unos minutos para formalizar tu propuesta. Muchas gracias por tu tiempo.`;
  
  return res.status(200).send(xml(`${say(mensajeCotizacion)}<Hangup/>`));
});

app.post('/finalizar-llamada', async (req, res) => {
  res.type('text/xml');
  const key = req.query?.key;
  const originalSpeech = req.query?.speech || '';
  const clientPhone = req.body?.From || 'Desconocido';

  enviarEmailReporte(clientPhone, key, originalSpeech, 'Normal (No seleccionó extra)');
  return res.status(200).send(xml(`${say('Perfecto. Tus datos han sido enviados a soporte. Un asesor te llamará en breve. Hasta luego.')}<Hangup/>`));
});

// ============================================================
// HELPER: FUNCIÓN ASÍNCRONA DE ENVÍO DE EMAIL (RESEND)
// ============================================================
async function enviarEmailReporte(phone, serviceKey, textoCliente, prioridad) {
  const serviceName = services[serviceKey]?.name || 'Consulta General / Desconocido';
  try {
    await resend.emails.send({
      from: 'BioMeyBot <onboarding@resend.dev>',
      to: '231183@ids.upchiapas.edu.mx',
      subject: `[${prioridad}] 🚨 Nuevo Reporte Bot - Tel: ${phone}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 600px;">
          <h2 style="color: #4f46e5;">📱 Reporte de Inteligencia Artificial - BioMey</h2>
          <hr/>
          <p><strong>👤 Teléfono del Cliente:</strong> ${phone}</p>
          <p><strong>🔍 Servicio Detectado:</strong> ${serviceName}</p>
          <p><strong>⚠️ Nivel/Prioridad:</strong> ${prioridad}</p>
          <p><strong>🗣️ Lo que dijo el cliente:</strong> "${textoCliente}"</p>
          <p><strong>🗓️ Fecha:</strong> ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">Procesado de forma inteligente impulsado por Gemini 2.5 y Resend API.</p>
        </div>
      `
    });
    console.log('Correo con IA enviado de forma exitosa.');
  } catch (err) {
    console.error('Error al enviar reporte de correo:', err.message);
  }
}

// ============================================================
// ENDPOINT: DISPARAR LLAMADA SALIENTE
// ============================================================
app.get('/make-call', async (req, res) => {
  const envAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const envAuthToken = process.env.TWILIO_AUTH_TOKEN;

  if (!envAccountSid || !envAuthToken) {
    return res.status(500).json({ status: 'error', message: 'Variables de entorno faltantes en Vercel.' });
  }

  try {
    const secureClient = twilio(envAccountSid.trim(), envAuthToken.trim());
    const call = await secureClient.calls.create({
      url: `${BASE_URL}/voice`,
      method: 'GET',
      to: '+528144384806',
      from: '+18312825317'
    });
    return res.json({ status: 'success', message: 'Llamada iniciada correctamente', callSid: call.sid });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = app;