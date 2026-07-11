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
  description: 'We are a digital solutions agency specialized in web development, mobile applications, and technology services.',
  phone: '33 4981 2319',
  email: 'soporte-biomey-tux@outlook.com',
  website: 'https://bio-mey-com-five.vercel.app/'
};

const services = {
  'web': {
    name: 'Web Development',
    description: 'We create professional, modern, and SEO optimized websites.',
    prices: 'From $2,500 MXN for landing pages up to $18,500 MXN for enterprise sites.',
    keywords: ['web', 'page', 'site', 'landing', 'design', 'development']
  },
  'app': {
    name: 'Mobile Applications',
    description: 'We develop intuitive and high-performance apps for Android and iOS.',
    prices: 'From $30,000 MXN for basic apps.',
    keywords: ['app', 'application', 'mobile', 'android', 'ios', 'phone']
  },
  'pc': {
    name: 'PC Maintenance',
    description: 'Preventive and corrective maintenance to make your computer run like new.',
    prices: 'From $250 MXN for basic maintenance.',
    keywords: ['pc', 'computer', 'maintenance', 'cleaning', 'virus', 'laptop']
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

  if (!lowerText || lowerText === 'hello' || lowerText === 'hi') {
    twiml.message(`Welcome to ${companyInfo.name}. ${companyInfo.description}`);
    res.header('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  }
  
  res.header('Content-Type', 'text/xml');
  return res.status(200).send(twiml.toString());
});

// ===== ENDPOINT 2: VOICE ENDPOINT (ENGLISH DIAGNOSTIC) =====
app.all('/voice', (req, res) => {
  res.type('text/xml');
  
  // Usamos voz nativa 'man' en inglés de Estados Unidos ('en-US')
  const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" timeout="5" speechTimeout="auto" action="${BASE_URL}/process-voice" method="GET" language="en-US">
        <Say language="en-US" voice="man">Hello. Welcome to BioMey. We are a digital solutions agency. What service are you interested in today? Web development, mobile apps, or computer maintenance?</Say>
    </Gather>
    <Say language="en-US" voice="man">I did not hear you. Goodbye.</Say>
</Response>`;

  return res.status(200).send(xmlResponse);
});

// ===== ENDPOINT 3: PROCESS VOICE (ENGLISH DIAGNOSTIC) =====
app.all('/process-voice', (req, res) => {
  res.type('text/xml');
  const speechResult = req.query?.SpeechResult || req.body?.SpeechResult;
  
  if (!speechResult) {
    const xmlRetry = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" timeout="5" action="${BASE_URL}/process-voice" method="GET" language="en-US">
        <Say language="en-US" voice="man">I did not hear you clearly. Could you repeat that?</Say>
    </Gather>
    <Say language="en-US" voice="man">Thank you for calling BioMey. Goodbye.</Say>
    <Hangup/>
</Response>`;
    return res.status(200).send(xmlRetry);
  }

  const lowerText = speechResult.toLowerCase();
  let responseText = 'Understood. An agent from BioMey will call you back shortly. Thank you.';

  if (lowerText.includes('price') || lowerText.includes('cost')) {
    responseText = 'Our prices vary. Web design starts at 2,500 pesos, and maintenance starts at 250 pesos.';
  } else {
    const detectedService = detectService(speechResult);
    if (detectedService && services[detectedService]) {
      const service = services[detectedService];
      responseText = `Great, you selected ${service.name}. ${service.description} The price is ${service.prices}.`;
    }
  }

  const xmlResult = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="en-US" voice="man">${responseText}</Say>
    <Hangup/>
</Response>`;

  return res.status(200).send(xmlResult);
});

// ===== ENDPOINT 4: MAKE CALL =====
app.all('/make-call', async (req, res) => {
  const envAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const envAuthToken = process.env.TWILIO_AUTH_TOKEN;

  if (!envAccountSid || !envAuthToken) {
    return res.status(500).json({ status: 'error', message: 'Environment variables missing.' });
  }

  try {
    const secureClient = twilio(envAccountSid.trim(), envAuthToken.trim());
    const call = await secureClient.calls.create({
      url: `${BASE_URL}/voice`,
      method: 'GET',
      to: '+528144384806', 
      from: '+18312825317' 
    });
    res.json({ status: 'success', callSid: call.sid });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ===== ENDPOINT 5: HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});