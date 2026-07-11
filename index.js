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

// URL base estática fija de tu backend en Vercel
const BASE_URL = 'https://biobot-six.vercel.app';

// ===== ENDPOINT 1: BOT DE WHATSAPP =====
app.all('/whatsapp', (req, res) => {
  const incomingMsg = req.body?.Body || req.query?.Body || '';
  const twiml = new twilio.twiml.MessagingResponse();
  
  const lowerText = incomingMsg.toLowerCase().trim();

  // Saludo inicial
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

  // Precios generales
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

  // Detección inteligente de servicios
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

  // Mensaje por defecto si no entiende la palabra clave
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

// ===== ENDPOINT 2: DE VOZ PRINCIPAL =====
app.all('/voice', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  
  const gather = twiml.gather({
    input: 'speech',
    timeout: 5,
    speechTimeout: 'auto',
    action: `${BASE_URL}/process-voice`,
    language: 'es-MX',
    enhanced: true,
  });
  
  gather.say(`¡Hola! Bienvenido a ${companyInfo.name}. ${companyInfo.description} ¿En qué servicio te gustaría que te ayudemos hoy?`);
  twiml.say(`No te he escuchado. Escríbenos por WhatsApp al ${companyInfo.phone}. Gracias por llamar.`);
  
  res.header('Content-Type', 'text/xml');
  return res.status(200).send(twiml.toString());
});

// ===== ENDPOINT 3: PROCESAMIENTO DE VOZ =====
app.all('/process-voice', (req, res) => {
  const speechResult = req.body?.SpeechResult || req.query?.SpeechResult;
  const twiml = new twilio.twiml.VoiceResponse();
  
  if (!speechResult) {
    const gather = twiml.gather({ 
      input: 'speech', 
      timeout: 5, 
      action: `${BASE_URL}/process-voice`, 
      language: 'es-MX' 
    });
    gather.say('No te he escuchado bien. ¿Puedes repetir qué servicio te interesa?');
    res.header('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  }

  const lowerText = speechResult.toLowerCase();
  if (lowerText.includes('precio') || lowerText.includes('costo')) {
    twiml.say('Nuestros precios varían. Diseño web desde $2,500 y mantenimiento desde $250.');
    res.header('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  }

  const detectedService = detectService(speechResult);
  if (detectedService && services[detectedService]) {
    const service = services[detectedService];
    twiml.say(`Elegiste ${service.name}. ${service.description} Precios: ${service.prices}`);
    res.header('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  }

  twiml.say('Gracias por llamarnos. Nos comunicaremos contigo pronto. ¡Hasta luego!');
  res.header('Content-Type', 'text/xml');
  return res.status(200).send(twiml.toString());
});

// ===== ENDPOINT 4: DISPARAR LLAMADA SALIENTE SEGURO =====
app.all('/make-call', async (req, res) => {
  const envAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const envAuthToken = process.env.TWILIO_AUTH_TOKEN;

  // Verificación de variables en Vercel
  if (!envAccountSid || !envAuthToken) {
    return res.status(500).json({ 
      status: 'error', 
      message: 'Las variables de entorno TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN no están configuradas en el panel de Vercel.' 
    });
  }

  try {
    // Inicialización interna usando .trim() para sanitizar strings de espacios fantasmas
    const secureClient = twilio(envAccountSid.trim(), envAuthToken.trim());

    const call = await secureClient.calls.create({
      url: `${BASE_URL}/voice`,
      to: '+528144384806', // Tu número verificado
      from: '+16802013265' // Tu número comprado en Twilio
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