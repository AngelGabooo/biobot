const express = require('express');
const twilio = require('twilio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const companyInfo = {
  name: 'BioMey',
  description: 'Somos una agencia de soluciones digitales especializada en desarrollo web, aplicaciones móviles y servicios tecnológicos.',
  phone: '33 4981 2319',
  email: 'soporte-biomey-tux@outlook.com',
  website: 'https://bio-mey-com-five.vercel.app/'
};

const services = {
  'web': {
    name: 'Desarrollo Web',
    description: 'Creamos páginas web profesionales, modernas y optimizadas para Google.',
    prices: 'Desde $2,500 MXN para landing pages, $6,500 para sitios de negocios, $11,500 para sitios profesionales y $18,500 para sitios empresariales.',
    details: 'Incluye diseño responsivo, optimización SEO, formularios de contacto, integración con redes sociales y soporte post-lanzamiento.',
    keywords: ['web', 'página', 'sitio', 'landing', 'pagina', 'diseño', 'desarrollo']
  },
  'app': {
    name: 'Aplicaciones Móviles',
    description: 'Desarrollamos apps para Android e iOS con diseño intuitivo y alto rendimiento.',
    prices: 'Desde $30,000 MXN para apps básicas, dependiendo de la complejidad.',
    details: 'Incluye diseño UX/UI, desarrollo nativo, notificaciones push e integración con APIs.',
    keywords: ['app', 'aplicación', 'movil', 'móvil', 'android', 'ios', 'celular']
  },
  'pc': {
    name: 'Mantenimiento de PC',
    description: 'Mantenimiento preventivo y correctivo para que tu equipo funcione como nuevo.',
    prices: 'Desde $250 MXN para mantenimiento preventivo básico.',
    details: 'Incluye limpieza física y de software, optimización, eliminación de virus y respaldo.',
    keywords: ['pc', 'computadora', 'mantenimiento', 'limpieza', 'virus', 'laptop']
  }
};

function detectService(text) {
  const lowerText = text.toLowerCase();
  for (const [key, service] of Object.entries(services)) {
    for (const keyword of service.keywords) {
      if (lowerText.includes(keyword)) return key;
    }
  }
  return null;
}

const BASE_URL = 'https://biobot-six.vercel.app';

// ===== ENDPOINT 1: BOT DE WHATSAPP =====
app.all('/whatsapp', (req, res) => {
  const incomingMsg = req.body?.Body || req.query?.Body || '';
  const twiml = new twilio.twiml.MessagingResponse();
  const lowerText = incomingMsg.toLowerCase().trim();

  if (!lowerText || lowerText === 'hola' || lowerText === 'inicio') {
    twiml.message(
      `¡Hola! Bienvenido a ${companyInfo.name}. ${companyInfo.description}\n\n` +
      `¿En qué servicio te gustaría que te ayudemos hoy?\n` +
      `• Desarrollo Web\n` +
      `• Aplicaciones Móviles\n` +
      `• Mantenimiento de PC`
    );
    res.header('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  }

  if (lowerText.includes('precio') || lowerText.includes('costo') || lowerText.includes('cuanto')) {
    twiml.message(
      `Nuestros precios varían según el servicio:\n` +
      `• Desarrollo Web: Desde $2,500 MXN\n` +
      `• Mantenimiento PC: Desde $250 MXN\n\n` +
      `¿Qué servicio te interesa para darte más detalles?`
    );
    res.header('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  }

  const detectedService = detectService(incomingMsg);
  if (detectedService && services[detectedService]) {
    const service = services[detectedService];
    twiml.message(
      `*${service.name}*\n` +
      `${service.description}\n\n` +
      `💰 *Precios:* ${service.prices}\n\n` +
      `¿Te gustaría agendar este servicio o prefieres hablar con un asesor?`
    );
    res.header('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  }

  twiml.message(
    `Entendido. Te recuerdo nuestros servicios principales:\n` +
    `• Desarrollo Web\n` +
    `• Aplicaciones Móviles\n` +
    `• Mantenimiento de PC\n\n` +
    `Escribe el nombre de cualquiera de ellos para ver detalles y precios.`
  );
  
  res.header('Content-Type', 'text/xml');
  return res.status(200).send(twiml.toString());
});

// ===== ENDPOINT 2: DE VOZ PRINCIPAL (MÉTODO GET EXTENDIDO) =====
app.all('/voice', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Cambiado a method: 'GET' para evitar bloqueos de peticiones POST externas en Vercel
  const gather = twiml.gather({
    input: 'speech',
    timeout: 8,
    speechTimeout: 'auto',
    action: `${BASE_URL}/process-voice`,
    method: 'GET',
    language: 'es-MX'
  });
  
  gather.say({ language: 'es-MX', voice: 'alice' }, `¡Hola! Bienvenido a ${companyInfo.name}. ${companyInfo.description} ¿En qué servicio te gustaría que te ayudemos hoy?`);
  
  twiml.say({ language: 'es-MX', voice: 'alice' }, 'No logré escucharte. Recuerda que puedes escribirnos por WhatsApp en cualquier momento. Gracias por llamar.');
  
  res.type('text/xml');
  return res.status(200).send(twiml.toString());
});

// ===== ENDPOINT 3: PROCESAMIENTO DE VOZ CORREGIDO (MÉTODO GET EXTENDIDO) =====
app.all('/process-voice', (req, res) => {
  // Leemos prioritariamente de req.query porque forzamos el flujo por GET
  const speechResult = req.query?.SpeechResult || req.body?.SpeechResult;
  const twiml = new twilio.twiml.VoiceResponse();
  
  if (!speechResult) {
    const gather = twiml.gather({ 
      input: 'speech', 
      timeout: 6, 
      action: `${BASE_URL}/process-voice`, 
      method: 'GET',
      language: 'es-MX' 
    });
    gather.say({ language: 'es-MX', voice: 'alice' }, 'No te escuché bien. ¿Podrías repetir qué servicio te interesa?');
    res.type('text/xml');
    return res.status(200).send(twiml.toString());
  }

  const lowerText = speechResult.toLowerCase();
  
  // Caso 1: Pregunta por precios
  if (lowerText.includes('precio') || lowerText.includes('costo') || lowerText.includes('cuánto')) {
    twiml.say({ language: 'es-MX', voice: 'alice' }, 'Nuestros precios varían según el proyecto. El diseño web va desde 2,500 pesos y el mantenimiento de computadoras desde 250 pesos. Puedes consultar más detalles en WhatsApp.');
    twiml.hangup();
    res.type('text/xml');
    return res.status(200).send(twiml.toString());
  }

  // Caso 2: Detección inteligente de servicios de la lista
  const detectedService = detectService(speechResult);
  if (detectedService && services[detectedService]) {
    const service = services[detectedService];
    twiml.say({ language: 'es-MX', voice: 'alice' }, `Excelente, elegiste ${service.name}. ${service.description} El costo aproximado es ${service.prices}. Un asesor se comunicará contigo a este número para cerrar los detalles.`);
    twiml.hangup();
    res.type('text/xml');
    return res.status(200).send(twiml.toString());
  }

  // Caso 3: No entendió la palabra
  twiml.say({ language: 'es-MX', voice: 'alice' }, 'Entendido. Tomamos tu reporte y un especialista de BioMey te llamará de regreso en unos minutos. Muchas gracias por tu tiempo.');
  twiml.hangup();

  res.type('text/xml');
  return res.status(200).send(twiml.toString());
});

// ===== ENDPOINT 4: DISPARAR LLAMADA SALIENTE SEGURO (MÉTODO GET CONFIGURADO) =====
app.all('/make-call', async (req, res) => {
  const envAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const envAuthToken = process.env.TWILIO_AUTH_TOKEN;

  if (!envAccountSid || !envAuthToken) {
    return res.status(500).json({ 
      status: 'error', 
      message: 'Las variables de entorno TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN no están configuradas en el panel de Vercel.' 
    });
  }

  try {
    const secureClient = twilio(envAccountSid.trim(), envAuthToken.trim());

    const call = await secureClient.calls.create({
      url: `${BASE_URL}/voice`,
      method: 'GET', // Le indicamos a Twilio que consuma nuestro XML inicial usando GET
      to: '+528144384806', 
      from: '+18312825317' 
    });

    res.json({ status: 'success', message: 'Llamada iniciada correctamente a través de Vercel', callSid: call.sid });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ===== ENDPOINT 5: HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor independiente BioMey corriendo perfectamente' });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});