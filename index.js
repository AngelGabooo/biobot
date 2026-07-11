const express = require('express');
const twilio = require('twilio');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicializamos Resend con la variable de entorno
const resend = new Resend(process.env.RESEND_API_KEY);

const companyInfo = {
  name: 'BioMey',
  description: 'Somos una agencia de soluciones digitales especializada en desarrollo web, aplicaciones móviles y servicios tecnológicos.',
  phone: '33 4981 2319',
  email: 'soporte-biomey-tux@outlook.com',
  website: 'https://bio-mey-com-five.vercel.app/'
};

// Catálogo de servicios. La clave se usa como identificador interno (query param "key").
const services = {
  landing: {
    name: 'Landing Page',
    prices: '2,500 pesos, en dos exhibiciones',
    description: 'Ideal para campañas publicitarias y promociones. Incluye diseño responsivo, formulario, botón de WhatsApp y entrega en 5 días.',
    keywords: ['landing', 'landing page', 'página de una sola vista', 'promociones']
  },
  negocios: {
    name: 'Página Web para Negocios',
    prices: '6,500 pesos, en dos exhibiciones',
    description: 'Para restaurantes, consultorios y pequeños negocios. Incluye hasta 6 secciones, dominio y hosting por un año, y correos empresariales.',
    keywords: ['negocios', 'negocio', 'restaurante', 'cafetería', 'consultorio', 'escuela', 'gimnasio']
  },
  profesional: {
    name: 'Página Web Profesional',
    prices: '11,500 pesos, en dos exhibiciones',
    description: 'Para empresas que desean destacar. Incluye hasta 15 secciones, blog administrable, portafolio, testimonios, SEO avanzado y chat flotante.',
    keywords: ['profesional', 'empresa profesional', 'blog administrable', 'seo avanzado']
  },
  empresarial: {
    name: 'Página Web Empresarial',
    prices: '18,500 pesos, en dos exhibiciones',
    description: 'Plataforma completa preparada para crecer. Incluye panel administrativo CMS, catálogo de productos, agenda de citas e integración con CRM.',
    keywords: ['empresarial', 'plataforma completa', 'catálogo', 'crm', 'cms']
  },
  ecommerce: {
    name: 'Tienda en Línea o E-commerce',
    prices: 'desde 15,000 pesos',
    description: 'Una plataforma completa con pasarela de pagos para vender tus productos en internet.',
    keywords: ['tienda', 'tienda en línea', 'ecommerce', 'comprar', 'vender productos', 'pasarela']
  },
  mantenimiento_preventivo: {
    name: 'Mantenimiento Preventivo de PC',
    prices: 'desde 250 pesos',
    description: 'Evita fallas futuras. Incluye limpieza interna y externa, optimización del sistema, revisión de componentes y actualización de controladores.',
    keywords: ['preventivo', 'limpieza', 'limpieza física', 'optimizar', 'actualizar controladores', 'lento']
  },
  mantenimiento_correctivo: {
    name: 'Mantenimiento Correctivo de PC',
    prices: 'depende del diagnóstico',
    description: 'Soluciona fallas y errores. Incluye reparación de hardware, eliminación de virus o malware, y recuperación de datos.',
    keywords: ['correctivo', 'reparación', 'reparar', 'no prende', 'pantalla azul', 'virus', 'malware', 'recuperar datos']
  },
  software: {
    name: 'Instalación y Configuración de Software',
    prices: 'bajo cotización',
    description: 'Instalamos y configuramos Windows, drivers, impresoras, paquetería de Office y programas especializados al 100 por ciento.',
    keywords: ['software', 'programas', 'instalar', 'windows', 'office', 'word', 'excel', 'drivers', 'impresora']
  },
  redes: {
    name: 'Soporte de Redes e Internet',
    prices: 'bajo cotización',
    description: 'Configuración y solución de problemas de conexión de red y señal de internet.',
    keywords: ['redes', 'internet', 'wifi', 'conexión', 'no tengo internet', 'router']
  }
};

// Mapea el número de submenú presionado -> clave del servicio
const webMenuMap = { '1': 'landing', '2': 'negocios', '3': 'profesional', '4': 'empresarial', '5': 'ecommerce' };
const mantenimientoMenuMap = { '1': 'mantenimiento_preventivo', '2': 'mantenimiento_correctivo' };
const soporteMenuMap = { '1': 'software', '2': 'redes' };

function detectServiceBySpeech(text) {
  const lowerText = (text || '').toLowerCase();
  for (const [key, service] of Object.entries(services)) {
    for (const keyword of service.keywords) {
      if (lowerText.includes(keyword)) return key;
    }
  }
  return null;
}

const BASE_URL = 'https://biobot-six.vercel.app';
const VOICE = { language: 'es-MX', voice: 'es-MX-Standard-A' };

// Frase legal + recordatorio de versión beta / Pro. Se reutiliza en varios puntos.
const AVISO_LEGAL =
  'Antes de continuar, te informamos que esta llamada está siendo monitoreada y grabada con fines de calidad. ' +
  'Recuerda que estás utilizando la versión beta de prueba de nuestro asistente virtual BioMey. ' +
  'La versión Pro ofrece muchas más funciones, personalización y automatización para tu negocio. ';

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
// ENDPOINT: MENÚ PRINCIPAL DE VOZ
// ============================================================
app.get('/voice', (req, res) => {
  res.type('text/xml');

  const menu =
    'Bienvenido a BioMey, tu agencia de soluciones digitales. ' +
    'Para páginas web, presiona 1. ' +
    'Para mantenimiento de computadoras, presiona 2. ' +
    'Para instalación de software o soporte de redes, presiona 3. ' +
    'Para repetir este menú, presiona 9. ' +
    'También puedes decir en voz alta el servicio que buscas.';

  const body =
    `<Gather input="dtmf speech" numDigits="1" timeout="6" speechTimeout="auto" action="${BASE_URL}/menu-principal" method="GET" language="es-MX">
        ${say(AVISO_LEGAL + menu)}
    </Gather>
    ${say('No recibimos ninguna respuesta. Puedes llamarnos de nuevo cuando gustes. Gracias por contactar a BioMey.')}
    <Hangup/>`;

  return res.status(200).send(xml(body));
});

// ============================================================
// ENDPOINT: PROCESA SELECCIÓN DEL MENÚ PRINCIPAL
// ============================================================
app.get('/menu-principal', (req, res) => {
  res.type('text/xml');
  const digit = req.query?.Digits;
  const speechResult = req.query?.SpeechResult;

  // Si el cliente dijo el servicio por voz, saltamos directo al detalle (atajo "inteligente")
  if (!digit && speechResult) {
    const detectedKey = detectServiceBySpeech(speechResult);
    if (detectedKey) {
      const body = redirectToDetail(detectedKey);
      return res.status(200).send(xml(body));
    }
  }

  let body;
  switch (digit) {
    case '1':
      body =
        `<Gather input="dtmf" numDigits="1" timeout="6" action="${BASE_URL}/menu-web" method="GET">
            ${say(
              'Páginas web. Landing Page, presiona 1. Página para negocios, presiona 2. ' +
              'Página profesional, presiona 3. Página empresarial, presiona 4. ' +
              'Tienda en línea o E-commerce, presiona 5. Para regresar al menú anterior, presiona 0.'
            )}
        </Gather>
        ${say('No recibimos tu respuesta. Gracias por llamar a BioMey.')}
        <Hangup/>`;
      break;

    case '2':
      body =
        `<Gather input="dtmf" numDigits="1" timeout="6" action="${BASE_URL}/menu-mantenimiento" method="GET">
            ${say(
              'Mantenimiento de computadoras. Mantenimiento preventivo, presiona 1. ' +
              'Mantenimiento correctivo o reparación, presiona 2. Para regresar al menú anterior, presiona 0.'
            )}
        </Gather>
        ${say('No recibimos tu respuesta. Gracias por llamar a BioMey.')}
        <Hangup/>`;
      break;

    case '3':
      body =
        `<Gather input="dtmf" numDigits="1" timeout="6" action="${BASE_URL}/menu-soporte" method="GET">
            ${say(
              'Software y redes. Instalación y configuración de software, presiona 1. ' +
              'Soporte de redes e internet, presiona 2. Para regresar al menú anterior, presiona 0.'
            )}
        </Gather>
        ${say('No recibimos tu respuesta. Gracias por llamar a BioMey.')}
        <Hangup/>`;
      break;

    case '9':
      body = redirectToVoice();
      break;

    default:
      body =
        `${say('No reconocimos esa opción.')}
        ${redirectToVoice()}`;
  }

  return res.status(200).send(xml(body));
});

// ============================================================
// SUBMENÚS: procesan la elección final de servicio
// ============================================================
app.get('/menu-web', (req, res) => {
  res.type('text/xml');
  const digit = req.query?.Digits;
  if (digit === '0') return res.status(200).send(xml(redirectToVoice()));
  const key = webMenuMap[digit];
  const body = key ? redirectToDetail(key) : invalidOptionRetry(`${BASE_URL}/voice`);
  return res.status(200).send(xml(body));
});

app.get('/menu-mantenimiento', (req, res) => {
  res.type('text/xml');
  const digit = req.query?.Digits;
  if (digit === '0') return res.status(200).send(xml(redirectToVoice()));
  const key = mantenimientoMenuMap[digit];
  const body = key ? redirectToDetail(key) : invalidOptionRetry(`${BASE_URL}/voice`);
  return res.status(200).send(xml(body));
});

app.get('/menu-soporte', (req, res) => {
  res.type('text/xml');
  const digit = req.query?.Digits;
  if (digit === '0') return res.status(200).send(xml(redirectToVoice()));
  const key = soporteMenuMap[digit];
  const body = key ? redirectToDetail(key) : invalidOptionRetry(`${BASE_URL}/voice`);
  return res.status(200).send(xml(body));
});

// ============================================================
// ENDPOINT: DETALLE DE SERVICIO (precio, descripción) + confirmación
// ============================================================
app.get('/detalle-servicio', (req, res) => {
  res.type('text/xml');
  const key = req.query?.key;
  const service = services[key];

  if (!service) {
    return res.status(200).send(xml(redirectToVoice()));
  }

  const detalle =
    `Has seleccionado: ${service.name}. ${service.description} Su costo es de ${service.prices}. ` +
    'Si deseas que un especialista tome tus datos y te contacte, presiona 1. ' +
    'Para regresar al menú principal, presiona 9.';

  const body =
    `<Gather input="dtmf" numDigits="1" timeout="6" action="${BASE_URL}/confirmar?key=${key}" method="GET">
        ${say(detalle)}
    </Gather>
    ${say('No recibimos tu respuesta. Gracias por llamar a BioMey.')}
    <Hangup/>`;

  return res.status(200).send(xml(body));
});

// ============================================================
// ENDPOINT: CONFIRMACIÓN FINAL + ENVÍO DE CORREO
// ============================================================
app.get('/confirmar', async (req, res) => {
  res.type('text/xml');
  const digit = req.query?.Digits;
  const key = req.query?.key;
  const service = services[key];
  const clientPhone = req.query?.From || 'Desconocido';

  if (digit === '9' || !service) {
    return res.status(200).send(xml(redirectToVoice()));
  }

  if (digit !== '1') {
    return res.status(200).send(
      xml(`${say('No reconocimos esa opción. Gracias por llamar a BioMey.')}<Hangup/>`)
    );
  }

  // Envío de correo vía Resend con el servicio detectado y el teléfono del cliente
  try {
    await resend.emails.send({
      from: 'BioMeyBot <onboarding@resend.dev>',
      to: '231183@ids.upchiapas.edu.mx',
      subject: `🚨 Nuevo Cliente Interesado - Tel: ${clientPhone}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 600px;">
          <h2 style="color: #4f46e5;">📱 Nuevo Reporte de Llamada Bot - BioMey</h2>
          <hr/>
          <p><strong>👤 Teléfono del Cliente:</strong> ${clientPhone}</p>
          <p><strong>🔍 Servicio Seleccionado:</strong> ${service.name}</p>
          <p><strong>💲 Precio:</strong> ${service.prices}</p>
          <p><strong>🗓️ Fecha:</strong> ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">Reporte procesado de forma segura vía Resend API. Selección hecha por menú de teclado (DTMF).</p>
        </div>
      `
    });
    console.log('Correo enviado con éxito usando Resend API.');
  } catch (emailError) {
    console.error('Error crítico en Resend API:', emailError.message);
  }

  const despedida =
    `Perfecto. Hemos registrado tu interés en ${service.name} de manera exitosa. ` +
    'Un especialista de BioMey se comunicará contigo a este número en unos minutos para darte una atención personalizada. ' +
    'Recuerda que esta fue una demostración de nuestra versión beta; la versión Pro incluye muchas más funciones para tu negocio. ' +
    'Muchas gracias por tu tiempo.';

  return res.status(200).send(xml(`${say(despedida)}<Hangup/>`));
});

// ============================================================
// Helpers de TwiML reutilizables
// ============================================================
function redirectToVoice() {
  return `<Redirect method="GET">${BASE_URL}/voice</Redirect>`;
}

function redirectToDetail(key) {
  return `<Redirect method="GET">${BASE_URL}/detalle-servicio?key=${key}</Redirect>`;
}

function invalidOptionRetry(url) {
  return `${say('No reconocimos esa opción.')}<Redirect method="GET">${url}</Redirect>`;
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
      // Para habilitar grabación REAL de la llamada (no solo el aviso hablado),
      // descomenta la siguiente línea:
      // record: true,
    });
    return res.json({ status: 'success', message: 'Llamada iniciada correctamente', callSid: call.sid });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = app;