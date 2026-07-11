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

// Diccionario extendido de servicios basados en tus planes e imágenes
const services = {
  'landing': {
    name: 'Landing Page',
    prices: '2,500 pesos, en dos exhibiciones.',
    description: 'Ideal para campañas publicitarias y promociones. Incluye diseño responsivo, formulario, boton de WhatsApp y entrega en 5 dias.',
    keywords: ['landing', 'landing page', 'pagina de una sola vista', 'promociones']
  },
  'negocios': {
    name: 'Pagina Web para Negocios',
    prices: '6,500 pesos, en dos exhibiciones.',
    description: 'Para restaurantes, consultorios y pequeños negocios. Incluye hasta 6 secciones, dominio y hosting por un año, y correos empresariales.',
    keywords: ['negocios', 'negocio', 'restaurante', 'cafeteria', 'consultorio', 'escuela', 'gimnasio']
  },
  'profesional': {
    name: 'Pagina Web Profesional',
    prices: '11,500 pesos, en dos exhibiciones.',
    description: 'Para empresas que desean destacar. Incluye hasta 15 secciones, blog administrable, portafolio, testimonios, SEO avanzado y chat flotante.',
    keywords: ['profesional', 'empresa profesional', 'blog administrable', 'seo avanzado']
  },
  'empresarial': {
    name: 'Pagina Web Empresarial',
    prices: '18,500 pesos, en dos exhibiciones.',
    description: 'Plataforma completa preparada para crecer. Incluye panel administrativo CMS, catalogo de productos, agenda de citas e integracion con CRM.',
    keywords: ['empresarial', 'plataforma completa', 'catalogo', 'crm', 'cms']
  },
  'ecommerce': {
    name: 'Tienda en Linea o E-commerce',
    prices: 'Desde 15,000 pesos.',
    description: 'Una plataforma completa con pasarela de pagos para vender tus productos en internet.',
    keywords: ['tienda', 'tienda en linea', 'ecommerce', 'comprar', 'vender productos', 'pasarela']
  },
  'mantenimiento_preventivo': {
    name: 'Mantenimiento Preventivo de PC',
    prices: 'Desde 250 pesos.',
    description: 'Evita fallas futuras. Incluye limpieza interna y externa, optimizacion del sistema, revision de componentes y actualizacion de controladores.',
    keywords: ['preventivo', 'limpieza', 'limpieza fisica', 'optimizar', 'actualizar controladores', 'lento']
  },
  'mantenimiento_correctivo': {
    name: 'Mantenimiento Correctivo de PC',
    prices: 'Depende del diagnostico.',
    description: 'Soluciona fallas y errores. Incluye reparacion de hardware, eliminacion de virus o malware, y recuperacion de datos.',
    keywords: ['correctivo', 'reparacion', 'reparar', 'no prende', 'pantalla azul', 'virus', 'malware', 'recuperar datos']
  },
  'software': {
    name: 'Instalacion y Configuracion de Software',
    prices: 'Bajo cotización.',
    description: 'Instalamos y configuramos Windows, drivers, impresoras, paqueteria de Office y programas especializados al 100 por ciento.',
    keywords: ['software', 'programas', 'instalar', 'windows', 'office', 'word', 'excel', 'drivers', 'impresora']
  },
  'redes': {
    name: 'Soporte de Redes e Internet',
    prices: 'Bajo cotización.',
    description: 'Configuracion y solucion de problemas de conexion de red y señal de internet.',
    keywords: ['redes', 'internet', 'wifi', 'conexion', 'no tengo internet', 'router']
  }
};

// Funcion para detectar que servicio busca el cliente
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
const MI_NUMERO_WHATSAPP = '+528144384806'; 
const TWILIO_NUMERO_WHATSAPP = 'whatsapp:+14155238886'; // Asegúrate de usar el Sandbox o tu número habilitado

// RUTA RAÍZ
app.get('/', (req, res) => {
  return res.status(200).send('Servidor BioMey Activo en Vercel');
});

// ENDPOINT 2: DE VOZ PRINCIPAL (VOZ MÁS CLARA)
app.get('/voice', (req, res) => {
  res.type('text/xml');
  const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" timeout="5" speechTimeout="auto" action="${BASE_URL}/process-voice" method="GET" language="es-MX">
        <Say language="es-MX" voice="es-MX-Standard-A">Hola. Bienvenido a BioMey. Somos una agencia de soluciones digitales. Ofrecemos diseño de Landing Pages, paginas web para negocios, tiendas virtuales, aplicaciones moviles y soporte tecnico o mantenimiento de computadoras. En que servicio te gustaria que te ayudemos hoy.</Say>
    </Gather>
    <Say language="es-MX" voice="es-MX-Standard-A">No logre escucharte. Recuerda que puedes escribirnos por WhatsApp en cualquier momento. Gracias por llamar.</Say>
</Response>`;
  return res.status(200).send(xmlResponse);
});

// ENDPOINT 3: PROCESAMIENTO DE VOZ, RESPUESTA A PREGUNTAS Y ENVÍO DE WHATSAPP
app.get('/process-voice', async (req, res) => {
  res.type('text/xml');
  const speechResult = req.query?.SpeechResult || '';
  const clientPhone = req.query?.From || 'Desconocido';
  
  if (!speechResult) {
    const xmlRetry = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" timeout="5" action="${BASE_URL}/process-voice" method="GET" language="es-MX">
        <Say language="es-MX" voice="es-MX-Standard-A">No te escuche bien. Podrias repetir que servicio o cotizacion necesitas.</Say>
    </Gather>
    <Say language="es-MX" voice="es-MX-Standard-A">Gracias por llamar a BioMey. Hasta luego.</Say>
    <Hangup/>
</Response>`;
    return res.status(200).send(xmlRetry);
  }

  const lowerText = speechResult.toLowerCase();
  let responseText = '';
  let serviceDetectedName = 'Consulta General / FAQ';

  // --- BLOQUE DE RESPUESTA A PREGUNTAS FRECUENTES (FAQ) ---
  if (lowerText.includes('precio') || lowerText.includes('costo') || lowerText.includes('cuanto cuesta')) {
    responseText = 'Nuestros precios dependen del paquete. La Landing Page cuesta 2,500 pesos, la pagina web de negocios 6,500 y el mantenimiento preventivo de computadoras va desde 250 pesos. ';
  } else if (lowerText.includes('pago') || lowerText.includes('pagar') || lowerText.includes('exhibiciones')) {
    responseText = 'Para tu comodidad, todos nuestros proyectos web se manejan en dos exhibiciones, cincuenta por ciento de anticipo y cincuenta por ciento al finalizar. ';
  } else if (lowerText.includes('tiempo') || lowerText.includes('tardan') || lowerText.includes('dias')) {
    responseText = 'Una landing page la entregamos en aproximadamente 5 dias, mientras que los proyectos mas complejos dependen de las secciones solicitadas. ';
  }

  // --- DETECCIÓN DE SERVICIOS ---
  const detectedKey = detectService(speechResult);
  if (detectedKey && services[detectedKey]) {
    const service = services[detectedKey];
    serviceDetectedName = service.name;
    responseText += `Excelente, sobre ${service.name}: ${service.description} Su costo es ${service.prices} `;
  }

  // Si no encajó en nada específico
  if (!responseText) {
    responseText = 'Entendido. Tomamos nota de tu solicitud sobre desarrollo e infraestructura tecnologica. ';
  }

  // Mensaje obligatorio al finalizar cada servicio
  responseText += 'Hemos registrado tu interes de manera exitosa. Un especialista de BioMey se comunicara contigo a este numero en unos minutos para darte una atencion personalizada. Muchas gracias por tu tiempo.';

  // --- ENVÍO EN SEGUNDO PLANO DEL REPORTE POR WHATSAPP ---
  const envAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const envAuthToken = process.env.TWILIO_AUTH_TOKEN;

  if (envAccountSid && envAuthToken) {
    try {
      const client = twilio(envAccountSid.trim(), envAuthToken.trim());
      
      // Enviamos un mensaje de texto plano y directo compatible con el Sandbox
      await client.messages.create({
        from: TWILIO_NUMERO_WHATSAPP,
        to: `whatsapp:${MI_NUMERO_WHATSAPP}`,
        body: `BioMey Reporte - Cliente: ${clientPhone}. Intencion: ${serviceDetectedName}. Dijo: ${speechResult}`
      });
      console.log('Notificación de WhatsApp enviada exitosamente.');
    } catch (wsError) {
      console.error('Error al enviar WhatsApp:', wsError.message);
    }
  }

  // Generamos la respuesta XML final
  const xmlResult = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="es-MX" voice="es-MX-Standard-A">${responseText}</Say>
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