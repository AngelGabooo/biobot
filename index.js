const express = require('express');
const twilio = require('twilio');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicialización perezosa: si falta RESEND_API_KEY, no debe tumbar todo el servidor.
// Se crea el cliente solo cuando realmente se va a enviar un correo.
function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY no está configurada en las variables de entorno.');
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

const companyInfo = {
  name: 'BioMey',
  description: 'Somos una agencia de soluciones digitales especializada en desarrollo web, aplicaciones móviles y servicios tecnológicos.',
  phone: '33 4981 2319',
  email: 'soporte-biomey-tux@outlook.com',
  website: 'https://bio-mey-com-five.vercel.app/'
};

// ============================================================
// CATÁLOGO DE SERVICIOS
// ============================================================
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

const webMenuMap = { '1': 'landing', '2': 'negocios', '3': 'profesional', '4': 'empresarial', '5': 'ecommerce' };
const mantenimientoMenuMap = { '1': 'mantenimiento_preventivo', '2': 'mantenimiento_correctivo' };
const soporteMenuMap = { '1': 'software', '2': 'redes' };

// Cotizador dinámico: preguntas de seguimiento solo para servicios donde el
// alcance puede variar mucho. Es lógica de negocio pura (árbol de decisión), sin IA.
const EXTRA_QUESTIONS = {
  profesional: {
    prompt: '¿Ya cuentas con dominio y hosting propios? Si ya los tienes, presiona 1. Si necesitas que te los incluyamos, presiona 2.',
    options: ['1', '2'],
    note: (d) => (d === '2'
      ? 'Te incluiremos dominio y hosting con costo adicional según disponibilidad.'
      : 'Usaremos el dominio y hosting que ya tienes, sin costo extra por ese concepto.')
  },
  empresarial: {
    prompt: '¿Ya cuentas con un sistema o CRM que quieras integrar, o necesitas uno nuevo? Si ya tienes uno, presiona 1. Si necesitas uno nuevo, presiona 2.',
    options: ['1', '2'],
    note: (d) => (d === '2'
      ? 'Incluiremos la configuración de un nuevo sistema CRM dentro de la propuesta.'
      : 'Integraremos el sistema o CRM que ya utilizas actualmente.')
  },
  ecommerce: {
    prompt: '¿Aproximadamente cuántos productos vas a vender? Menos de 50, presiona 1. Entre 50 y 200, presiona 2. Más de 200, presiona 3.',
    options: ['1', '2', '3'],
    note: (d) => {
      if (d === '1') return 'Con menos de 50 productos, tu tienda entra en nuestro paquete base de e-commerce.';
      if (d === '2') return 'Con ese volumen de productos podríamos requerir un plan intermedio; el precio final se ajusta en cotización.';
      return 'Con más de 200 productos se recomienda un plan robusto; el costo final se define en cotización personalizada.';
    }
  }
};

function needsExtraQuestion(key) {
  return Object.prototype.hasOwnProperty.call(EXTRA_QUESTIONS, key);
}

function detectServiceBySpeech(text) {
  const lowerText = (text || '').toLowerCase();
  for (const [key, service] of Object.entries(services)) {
    for (const keyword of service.keywords) {
      if (lowerText.includes(keyword)) return key;
    }
  }
  return null;
}

// ============================================================
// CONFIGURACIÓN GENERAL
// ============================================================
const BASE_URL = 'https://biobot-six.vercel.app';
const VOICE = { language: 'es-MX', voice: 'es-MX-Standard-A' };
const TWILIO_CALLER_ID = '+18312825317';

// Configura este número real en Vercel (Settings > Environment Variables > ADVISOR_PHONE_NUMBER)
// para que la tecla 0 transfiera la llamada con un asesor de verdad.
const ADVISOR_NUMBER = process.env.ADVISOR_PHONE_NUMBER || '+528144384806';

const MAX_INTENTOS = 3; // intentos fallidos antes de escalar automáticamente con un asesor

const AVISO_LEGAL =
  'Antes de continuar, te informamos que esta llamada está siendo monitoreada y grabada con fines de calidad. ' +
  'Recuerda que estás utilizando la versión beta de prueba de nuestro asistente virtual BioMey. ' +
  'La versión Pro ofrece muchas más funciones, personalización y automatización para tu negocio. ';

const AYUDA_TECLAS =
  'En cualquier momento puedes presionar asterisco para repetir la opción actual, ' +
  'numeral para volver a este menú principal, o cero para hablar directamente con un asesor. ';

function say(text) {
  return `<Say language="${VOICE.language}" voice="${VOICE.voice}">${text}</Say>`;
}

function xml(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${body}\n</Response>`;
}

function qs(params = {}) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

function fullUrl(path, params) {
  return `${BASE_URL}${path}${qs(params)}`;
}

function redirectTo(path, params) {
  return `<Redirect method="GET">${fullUrl(path, params)}</Redirect>`;
}

// ============================================================
// HORARIO INTELIGENTE
// ============================================================
function isBusinessHours() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const day = now.getDay(); // 0 = domingo
  const hour = now.getHours();
  if (day === 0) return false;
  return hour >= 9 && hour < 19;
}

function scheduleNote() {
  return isBusinessHours()
    ? 'Un especialista de BioMey se comunicará contigo a este número en unos minutos.'
    : 'En este momento estamos fuera de nuestro horario de atención, pero hemos registrado tu solicitud. ' +
      'Un especialista te contactará el siguiente día hábil.';
}

// ============================================================
// NAVEGACIÓN UNIVERSAL (*, #, 0) + ESCALAMIENTO POR INTENTOS
// ============================================================
// selfPath/selfParams describen la URL de "render" a la que hay que regresar
// si el cliente presiona * (repetir el mensaje actual).
function handleUniversalKeys(req, res, selfPath, selfParams) {
  const digit = req.query?.Digits;

  if (digit === '*') {
    res.type('text/xml');
    res.status(200).send(xml(redirectTo(selfPath, selfParams)));
    return true;
  }

  if (digit === '#') {
    res.type('text/xml');
    res.status(200).send(xml(redirectTo('/voice', {})));
    return true;
  }

  if (digit === '0') {
    res.type('text/xml');
    res.status(200).send(xml(transferirConAsesor()));
    return true;
  }

  return false;
}

function transferirConAsesor() {
  return (
    say('Te comunico con un asesor, un momento por favor.') +
    `<Dial timeout="20" callerId="${TWILIO_CALLER_ID}" action="${BASE_URL}/despues-de-asesor" method="GET">${ADVISOR_NUMBER}</Dial>`
  );
}

// Cuando se agotan los intentos válidos en un estado, escalamos directo con un asesor
// en vez de seguir repitiendo el menú indefinidamente.
function retryOrEscalate(req, res, selfPath, selfParams) {
  const intentos = parseInt(req.query?.intentos || '0', 10) + 1;
  res.type('text/xml');
  if (intentos >= MAX_INTENTOS) {
    const body = say('No logramos identificar tu opción después de varios intentos.') + transferirConAsesor();
    return res.status(200).send(xml(body));
  }
  const body = say('No reconocimos esa opción, intentemos de nuevo.') +
    redirectTo(selfPath, { ...selfParams, intentos });
  return res.status(200).send(xml(body));
}

app.get('/despues-de-asesor', (req, res) => {
  res.type('text/xml');
  const status = req.query?.DialCallStatus;
  const body = (status === 'completed' || status === 'answered')
    ? say('Gracias por llamar a BioMey. Que tengas excelente día.') + '<Hangup/>'
    : say('En este momento nuestro asesor no pudo contestar. Hemos registrado tu intento de contacto y te buscaremos lo antes posible. Gracias por llamar a BioMey.') + '<Hangup/>';
  return res.status(200).send(xml(body));
});

// RUTA RAÍZ
app.get('/', (req, res) => {
  return res.status(200).send('Servidor BioMey Activo en Vercel');
});

// ============================================================
// ESTADO: MENÚ PRINCIPAL
// ============================================================
app.get('/voice', (req, res) => {
  res.type('text/xml');
  const intentos = req.query?.intentos || '0';

  const menu =
    'Bienvenido a BioMey, tu agencia de soluciones digitales. ' +
    'Para páginas web, presiona 1. ' +
    'Para mantenimiento de computadoras, presiona 2. ' +
    'Para instalación de software o soporte de redes, presiona 3. ' +
    'También puedes decir en voz alta el servicio que buscas.';

  const body =
    `<Gather input="dtmf speech" numDigits="1" timeout="6" speechTimeout="auto" action="${fullUrl('/menu-principal', { intentos })}" method="GET" language="es-MX">
        ${say(AVISO_LEGAL + AYUDA_TECLAS + menu)}
    </Gather>
    ${say('No recibimos ninguna respuesta. Puedes llamarnos de nuevo cuando gustes. Gracias por contactar a BioMey.')}
    <Hangup/>`;

  return res.status(200).send(xml(body));
});

app.get('/menu-principal', (req, res) => {
  if (handleUniversalKeys(req, res, '/voice', {})) return;
  res.type('text/xml');

  const digit = req.query?.Digits;
  const speechResult = req.query?.SpeechResult;

  if (!digit && speechResult) {
    const detectedKey = detectServiceBySpeech(speechResult);
    if (detectedKey) {
      return res.status(200).send(xml(redirectTo('/estado/detalle', { key: detectedKey })));
    }
  }

  switch (digit) {
    case '1': return res.status(200).send(xml(redirectTo('/estado/web', {})));
    case '2': return res.status(200).send(xml(redirectTo('/estado/mantenimiento', {})));
    case '3': return res.status(200).send(xml(redirectTo('/estado/soporte', {})));
    default: return retryOrEscalate(req, res, '/voice', {});
  }
});

// ============================================================
// ESTADO: SUBMENÚ PÁGINAS WEB
// ============================================================
app.get('/estado/web', (req, res) => {
  res.type('text/xml');
  const intentos = req.query?.intentos || '0';
  const body =
    `<Gather input="dtmf" numDigits="1" timeout="6" action="${fullUrl('/menu-web', { intentos })}" method="GET">
        ${say(
          'Páginas web. Landing Page, presiona 1. Página para negocios, presiona 2. ' +
          'Página profesional, presiona 3. Página empresarial, presiona 4. ' +
          'Tienda en línea o E-commerce, presiona 5.'
        )}
    </Gather>
    ${say('No recibimos tu respuesta. Gracias por llamar a BioMey.')}
    <Hangup/>`;
  return res.status(200).send(xml(body));
});

app.get('/menu-web', (req, res) => {
  if (handleUniversalKeys(req, res, '/estado/web', {})) return;
  const digit = req.query?.Digits;
  const key = webMenuMap[digit];
  res.type('text/xml');
  if (key) return res.status(200).send(xml(redirectTo('/estado/detalle', { key })));
  return retryOrEscalate(req, res, '/estado/web', {});
});

// ============================================================
// ESTADO: SUBMENÚ MANTENIMIENTO
// ============================================================
app.get('/estado/mantenimiento', (req, res) => {
  res.type('text/xml');
  const intentos = req.query?.intentos || '0';
  const body =
    `<Gather input="dtmf" numDigits="1" timeout="6" action="${fullUrl('/menu-mantenimiento', { intentos })}" method="GET">
        ${say(
          'Mantenimiento de computadoras. Mantenimiento preventivo, presiona 1. ' +
          'Mantenimiento correctivo o reparación, presiona 2.'
        )}
    </Gather>
    ${say('No recibimos tu respuesta. Gracias por llamar a BioMey.')}
    <Hangup/>`;
  return res.status(200).send(xml(body));
});

app.get('/menu-mantenimiento', (req, res) => {
  if (handleUniversalKeys(req, res, '/estado/mantenimiento', {})) return;
  const digit = req.query?.Digits;
  const key = mantenimientoMenuMap[digit];
  res.type('text/xml');
  if (key) return res.status(200).send(xml(redirectTo('/estado/detalle', { key })));
  return retryOrEscalate(req, res, '/estado/mantenimiento', {});
});

// ============================================================
// ESTADO: SUBMENÚ SOFTWARE Y REDES
// ============================================================
app.get('/estado/soporte', (req, res) => {
  res.type('text/xml');
  const intentos = req.query?.intentos || '0';
  const body =
    `<Gather input="dtmf" numDigits="1" timeout="6" action="${fullUrl('/menu-soporte', { intentos })}" method="GET">
        ${say(
          'Software y redes. Instalación y configuración de software, presiona 1. ' +
          'Soporte de redes e internet, presiona 2.'
        )}
    </Gather>
    ${say('No recibimos tu respuesta. Gracias por llamar a BioMey.')}
    <Hangup/>`;
  return res.status(200).send(xml(body));
});

app.get('/menu-soporte', (req, res) => {
  if (handleUniversalKeys(req, res, '/estado/soporte', {})) return;
  const digit = req.query?.Digits;
  const key = soporteMenuMap[digit];
  res.type('text/xml');
  if (key) return res.status(200).send(xml(redirectTo('/estado/detalle', { key })));
  return retryOrEscalate(req, res, '/estado/soporte', {});
});

// ============================================================
// ESTADO: DETALLE DEL SERVICIO (precio + descripción)
// ============================================================
app.get('/estado/detalle', (req, res) => {
  res.type('text/xml');
  const key = req.query?.key;
  const intentos = req.query?.intentos || '0';
  const service = services[key];

  if (!service) return res.status(200).send(xml(redirectTo('/voice', {})));

  const detalle =
    `${service.name}. ${service.description} Su costo es de ${service.prices}. ` +
    'Si deseas continuar con este servicio, presiona 1.';

  const body =
    `<Gather input="dtmf" numDigits="1" timeout="6" action="${fullUrl('/manejar-detalle', { key, intentos })}" method="GET">
        ${say(detalle)}
    </Gather>
    ${say('No recibimos tu respuesta. Gracias por llamar a BioMey.')}
    <Hangup/>`;
  return res.status(200).send(xml(body));
});

app.get('/manejar-detalle', (req, res) => {
  const key = req.query?.key;
  if (handleUniversalKeys(req, res, '/estado/detalle', { key })) return;

  res.type('text/xml');
  const digit = req.query?.Digits;
  const service = services[key];
  if (!service) return res.status(200).send(xml(redirectTo('/voice', {})));

  if (digit === '1') {
    // Cotizador dinámico: solo algunos servicios tienen preguntas de seguimiento
    if (needsExtraQuestion(key)) {
      return res.status(200).send(xml(redirectTo('/estado/pregunta', { key })));
    }
    return res.status(200).send(xml(redirectTo('/estado/confirmar', { key })));
  }

  return retryOrEscalate(req, res, '/estado/detalle', { key });
});

// ============================================================
// ESTADO: PREGUNTA DE COTIZADOR DINÁMICO
// ============================================================
app.get('/estado/pregunta', (req, res) => {
  res.type('text/xml');
  const key = req.query?.key;
  const intentos = req.query?.intentos || '0';
  const config = EXTRA_QUESTIONS[key];

  if (!config) return res.status(200).send(xml(redirectTo('/estado/confirmar', { key })));

  const body =
    `<Gather input="dtmf" numDigits="1" timeout="6" action="${fullUrl('/manejar-pregunta', { key, intentos })}" method="GET">
        ${say(config.prompt)}
    </Gather>
    ${say('No recibimos tu respuesta. Gracias por llamar a BioMey.')}
    <Hangup/>`;
  return res.status(200).send(xml(body));
});

app.get('/manejar-pregunta', (req, res) => {
  const key = req.query?.key;
  if (handleUniversalKeys(req, res, '/estado/pregunta', { key })) return;

  res.type('text/xml');
  const digit = req.query?.Digits;
  const config = EXTRA_QUESTIONS[key];
  if (!config) return res.status(200).send(xml(redirectTo('/estado/confirmar', { key })));

  if (config.options.includes(digit)) {
    return res.status(200).send(xml(redirectTo('/estado/confirmar', { key, extra: digit })));
  }

  return retryOrEscalate(req, res, '/estado/pregunta', { key });
});

// ============================================================
// ESTADO: CONFIRMACIÓN CON OPCIÓN DE CORREGIR
// ============================================================
app.get('/estado/confirmar', (req, res) => {
  res.type('text/xml');
  const key = req.query?.key;
  const extra = req.query?.extra;
  const intentos = req.query?.intentos || '0';
  const service = services[key];

  if (!service) return res.status(200).send(xml(redirectTo('/voice', {})));

  let resumen = `Entonces tu solicitud es: ${service.name}, con un costo de ${service.prices}.`;
  const config = EXTRA_QUESTIONS[key];
  if (config && extra) {
    resumen += ` ${config.note(extra)}`;
  }

  const confirmacion =
    `${resumen} Si todo es correcto y quieres que un especialista te contacte, presiona 1. ` +
    'Si quieres corregir tu selección, presiona 2.';

  const body =
    `<Gather input="dtmf" numDigits="1" timeout="6" action="${fullUrl('/manejar-confirmar', { key, extra, intentos })}" method="GET">
        ${say(confirmacion)}
    </Gather>
    ${say('No recibimos tu respuesta. Gracias por llamar a BioMey.')}
    <Hangup/>`;
  return res.status(200).send(xml(body));
});

app.get('/manejar-confirmar', async (req, res) => {
  const key = req.query?.key;
  const extra = req.query?.extra;
  if (handleUniversalKeys(req, res, '/estado/confirmar', { key, extra })) return;

  res.type('text/xml');
  const digit = req.query?.Digits;
  const service = services[key];
  const clientPhone = req.query?.From || 'Desconocido';

  if (!service) return res.status(200).send(xml(redirectTo('/voice', {})));

  if (digit === '2') {
    return res.status(200).send(xml(say('Sin problema, regresemos al menú principal.') + redirectTo('/voice', {})));
  }

  if (digit !== '1') {
    return retryOrEscalate(req, res, '/estado/confirmar', { key, extra });
  }

  const notaExtra = (EXTRA_QUESTIONS[key] && extra) ? EXTRA_QUESTIONS[key].note(extra) : '';

  try {
    const resend = getResendClient();
    if (!resend) throw new Error('Cliente de Resend no disponible (falta RESEND_API_KEY).');
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
          ${notaExtra ? `<p><strong>📝 Detalle adicional:</strong> ${notaExtra}</p>` : ''}
          <p><strong>🗓️ Fecha:</strong> ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</p>
          <p><strong>🕒 Dentro de horario laboral:</strong> ${isBusinessHours() ? 'Sí' : 'No'}</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">Reporte procesado vía Resend API. Selección hecha por menú de teclado (DTMF).</p>
        </div>
      `
    });
    console.log('Correo enviado con éxito usando Resend API.');
  } catch (emailError) {
    console.error('Error crítico en Resend API:', emailError.message);
  }

  const despedida =
    `Perfecto. Hemos registrado tu interés en ${service.name} de manera exitosa. ${scheduleNote()} ` +
    'Recuerda que esta fue una demostración de nuestra versión beta; la versión Pro incluye muchas más funciones para tu negocio. ' +
    'Muchas gracias por tu tiempo.';

  return res.status(200).send(xml(say(despedida) + '<Hangup/>'));
});

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
      from: TWILIO_CALLER_ID
      // Para habilitar grabación REAL de la llamada (no solo el aviso hablado),
      // descomenta la siguiente línea:
      // record: true,
    });
    return res.json({ status: 'success', message: 'Llamada iniciada correctamente', callSid: call.sid });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// ============================================================
// RED DE SEGURIDAD: si algo truena sin control, responder con
// TwiML válido en vez de dejar que Twilio reciba un error crudo.
// ============================================================
app.use((err, req, res, next) => {
  console.error('Error no controlado en el bot:', err);
  res.type('text/xml');
  return res.status(200).send(
    xml(say('Ocurrió un problema técnico. Por favor intenta llamar de nuevo en unos minutos. Gracias por tu paciencia.') + '<Hangup/>')
  );
});

module.exports = app;