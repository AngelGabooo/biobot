const express = require('express');
const twilio = require('twilio');
const cors = require('cors');
const nodemailer = require('nodemailer');

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
  'landing': {
    name: 'Landing Page',
    prices: '2,500 pesos, en dos exhibiciones.',
    description: 'Ideal para campañas publicitarias y promociones. Incluye diseño responsivo, formulario, botón de WhatsApp y entrega en 5 días.',
    keywords: ['landing', 'landing page', 'página de una sola vista', 'promociones']
  },
  'negocios': {
    name: 'Página Web para Negocios',
    prices: '6,500 pesos, en dos exhibiciones.',
    description: 'Para restaurantes, consultorios y pequeños negocios. Incluye hasta 6 secciones, dominio y hosting por un año, y correos empresariales.',
    keywords: ['negocios', 'negocio', 'restaurante', 'cafetería', 'consultorio', 'escuela', 'gimnasio']
  },
  'profesional': {
    name: 'Página Web Profesional',
    prices: '11,500 pesos, en dos exhibiciones.',
    description: 'Para empresas que desean destacar. Incluye hasta 15 secciones, blog administrable, portafolio, testimonios, SEO avanzado y chat flotante.',
    keywords: ['profesional', 'empresa profesional', 'blog administrable', 'seo avanzado']
  },
  'empresarial': {
    name: 'Página Web Empresarial',
    prices: '18,500 pesos, en dos exhibiciones.',
    description: 'Plataforma completa preparada para crecer. Incluye panel administrativo CMS, catálogo de productos, agenda de citas e integración con CRM.',
    keywords: ['empresarial', 'plataforma completa', 'catálogo', 'crm', 'cms']
  },
  'ecommerce': {
    name: 'Tienda en Línea o E-commerce',
    prices: 'Desde 15,000 pesos.',
    description: 'Una plataforma completa con pasarela de pagos para vender tus productos en internet.',
    keywords: ['tienda', 'tienda en línea', 'ecommerce', 'comprar', 'vender productos', 'pasarela']
  },
  'mantenimiento_preventivo': {
    name: 'Mantenimiento Preventivo de PC',
    prices: 'Desde 250 pesos.',
    description: 'Evita fallas futuras. Incluye limpieza interna y externa, optimización del sistema, revisión de componentes y actualización de controladores.',
    keywords: ['preventivo', 'limpieza', 'limpieza física', 'optimizar', 'actualizar controladores', 'lento']
  },
  'mantenimiento_correctivo': {
    name: 'Mantenimiento Correctivo de PC',
    prices: 'Depende del diagnóstico.',
    description: 'Soluciona fallas y errores. Incluye reparación de hardware, eliminación de virus o malware, y recuperación de datos.',
    keywords: ['correctivo', 'reparación', 'reparar', 'no prende', 'pantalla azul', 'virus', 'malware', 'recuperar datos']
  },
  'software': {
    name: 'Instalación y Configuración de Software',
    prices: 'Bajo cotización.',
    description: 'Instalamos y configuramos Windows, drivers, impresoras, paquetería de Office y programas especializados al 100 por ciento.',
    keywords: ['software', 'programas', 'instalar', 'windows', 'office', 'word', 'excel', 'drivers', 'impresora']
  },
  'redes': {
    name: 'Soporte de Redes e Internet',
    prices: 'Bajo cotización.',
    description: 'Configuración y solución de problemas de conexión de red y señal de internet.',
    keywords: ['redes', 'internet', 'wifi', 'conexión', 'no tengo internet', 'router']
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

// CONFIGURACIÓN DEL TRANSPORTADOR DE NODEMAILER (OUTLOOK)
const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false, // true para 465, false para otros puertos
  auth: {
    user: companyInfo.email,
    pass: process.env.EMAIL_PASSWORD // Tu contraseña de aplicación guardada en Vercel
  },
  tls: {
    ciphers: 'SSLv3'
  }
});

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
        <Say language="es-MX" voice="es-MX-Standard-A">Hola. Bienvenido a BioMey. Somos una agencia de soluciones digitales. Ofrecemos diseño de Landing Pages, páginas web para negocios, tiendas virtuales, aplicaciones móviles y soporte técnico o mantenimiento de computadoras. En qué servicio te gustaría que te ayudemos hoy.</Say>
    </Gather>
    <Say language="es-MX" voice="es-MX-Standard-A">No logré escucharte. Recuerda que puedes escribirnos por WhatsApp en cualquier momento. Gracias por llamar.</Say>
</Response>`;
  return res.status(200).send(xmlResponse);
});

// ENDPOINT 3: PROCESAMIENTO DE VOZ Y ENVÍO DE EMAIL
app.get('/process-voice', async (req, res) => {
  res.type('text/xml');
  const speechResult = req.query?.SpeechResult || '';
  const clientPhone = req.query?.From || 'Desconocido';
  
  if (!speechResult) {
    const xmlRetry = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" timeout="5" action="${BASE_URL}/process-voice" method="GET" language="es-MX">
        <Say language="es-MX" voice="es-MX-Standard-A">No te escuché bien. Podrías repetir qué servicio o cotización necesitas.</Say>
    </Gather>
    <Say language="es-MX" voice="es-MX-Standard-A">Gracias por llamar a BioMey. Hasta luego.</Say>
    <Hangup/>
</Response>`;
    return res.status(200).send(xmlRetry);
  }

  const lowerText = speechResult.toLowerCase();
  let responseText = '';
  let serviceDetectedName = 'Consulta General / Pregunta Frecuente';

  if (lowerText.includes('precio') || lowerText.includes('costo') || lowerText.includes('cuánto cuesta')) {
    responseText = 'Nuestros precios dependen del paquete. La Landing Page cuesta 2,500 pesos, la página web de negocios 6,500 y el mantenimiento preventivo de computadoras va desde 250 pesos. ';
  } else if (lowerText.includes('pago') || lowerText.includes('pagar') || lowerText.includes('exhibiciones')) {
    responseText = 'Para tu comodidad, todos nuestros proyectos web se manejan en dos exhibiciones, cincuenta por ciento de anticipo y cincuenta por ciento al finalizar. ';
  } else if (lowerText.includes('tiempo') || lowerText.includes('tardan') || lowerText.includes('días')) {
    responseText = 'Una landing page la entregamos en aproximadamente 5 días, mientras que los proyectos más complejos dependen de las secciones solicitadas. ';
  }

  const detectedKey = detectService(speechResult);
  if (detectedKey && services[detectedKey]) {
    const service = services[detectedKey];
    serviceDetectedName = service.name;
    responseText += `Excelente, sobre ${service.name}: ${service.description} Su costo es ${service.prices} `;
  }

  if (!responseText) {
    responseText = 'Entendido. Tomamos nota de tu solicitud sobre desarrollo e infraestructura tecnológica. ';
  }

  responseText += 'Hemos registrado tu interés de manera exitosa. Un especialista de BioMey se comunicará contigo a este número en unos minutos para darte una atención personalizada. Muchas gracias por tu tiempo.';

  // --- ENVÍO DEL REPORTES AUTOMÁTICO POR EMAIL ---
  const mailOptions = {
    from: companyInfo.email,
    to: 'soporte-biomey-tux@outlook.com', // Te lo mandas a ti mismo
    subject: `🚨 Nuevo Cliente Interesado - Tel: ${clientPhone}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 600px;">
        <h2 style="color: #0078d4;">📱 Nuevo Reporte de Llamada Bot - BioMey</h2>
        <hr/>
        <p><strong>👤 Teléfono del Cliente:</strong> ${clientPhone}</p>
        <p><strong>🔍 Servicio Detectado:</strong> ${serviceDetectedName}</p>
        <p><strong>🗣️ Transcripción de Voz:</strong> "${speechResult}"</p>
        <hr/>
        <p style="font-size: 12px; color: #666;">Este es un mensaje automático generado por tu servidor Express en Vercel.</p>
      </div>
    `
  };

  // Enviamos el correo de forma asíncrona en segundo plano
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error al enviar el correo:', error);
    } else {
      console.log('Correo enviado con éxito: ' + info.response);
    }
  });

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