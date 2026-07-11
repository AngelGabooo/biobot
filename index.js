const express = require('express');
const twilio = require('twilio');
const cors = require('cors');

const app = express();

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
    description: 'Creamos paginas web profesionales, modernas y optimizadas para Google.',
    prices: 'Desde 2500 pesos para landing pages, 6500 para sitios de negocios, 11500 para sitios profesionales y 18500 para sitios empresariales.',
    keywords: ['web', 'página', 'sitio', 'landing', 'pagina', 'diseño', 'desarrollo']
  },
  'app': {
    name: 'Aplicaciones Móviles',
    description: 'Desarrollamos apps para Android e iOS con diseño intuitivo y alto rendimiento.',
    prices: 'Desde 30000 pesos para apps básicas.',
    keywords: ['app', 'aplicación', 'movil', 'móvil', 'android', 'ios', 'celular']
  },
  'pc': {
    name: 'Mantenimiento de PC',
    description: 'Mantenimiento preventivo y correctivo para que tu equipo funcione como nuevo.',
    prices: 'Desde 250 pesos para mantenimiento preventivo básico.',
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

// RUTA RAÍZ
app.get('/', (req, res) => {
  return res.status(200).send('Servidor BioMey Activo en Vercel');
});

// ENDPOINT 2: DE VOZ PRINCIPAL
app.get('/voice', (req, res) => {
  res.type('text/xml');
  const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" timeout="5" speechTimeout="auto" action="${BASE_URL}/process-voice" method="GET" language="es-MX">
        <Say language="es-MX" voice="man">Hola. Bienvenido a BioMey. Somos una agencia de soluciones digitales especializada en desarrollo web, aplicaciones móviles y servicios tecnológicos. En que servicio te gustaría que te ayudemos hoy.</Say>
    </Gather>
    <Say language="es-MX" voice="man">No logre escucharte. Recuerda que puedes escribirnos por WhatsApp en cualquier momento. Gracias por llamar.</Say>
</Response>`;
  return res.status(200).send(xmlResponse);
});

// ENDPOINT 3: PROCESAMIENTO DE VOZ
app.get('/process-voice', (req, res) => {
  res.type('text/xml');
  const speechResult = req.query?.SpeechResult || '';
  
  if (!speechResult) {
    const xmlRetry = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" timeout="5" action="${BASE_URL}/process-voice" method="GET" language="es-MX">
        <Say language="es-MX" voice="man">No te escuche bien. Podrías repetir que servicio te interesa.</Say>
    </Gather>
    <Say language="es-MX" voice="man">Gracias por llamar a BioMey. Hasta luego.</Say>
    <Hangup/>
</Response>`;
    return res.status(200).send(xmlRetry);
  }

  const lowerText = speechResult.toLowerCase();
  let responseText = 'Entendido. Tomamos tu reporte y un especialista de BioMey te llamara de regreso en unos minutos. Muchas gracias por tu tiempo.';

  if (lowerText.includes('precio') || lowerText.includes('costo')) {
    responseText = 'Nuestros precios varían según el proyecto. El diseño web va desde 2,500 pesos y el mantenimiento de computadoras desde 250 pesos.';
  } else {
    const detectedService = detectService(speechResult);
    if (detectedService && services[detectedService]) {
      const service = services[detectedService];
      responseText = `Excelente, elegiste ${service.name}. ${service.description} El costo aproximado es ${service.prices}.`;
    }
  }

  const xmlResult = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="es-MX" voice="man">${responseText}</Say>
    <Hangup/>
</Response>`;

  return res.status(200).send(xmlResult);
});

// ENDPOINT 4: DISPARAR LLAMADA SALIENTE
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