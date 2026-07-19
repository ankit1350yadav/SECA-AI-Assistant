import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { dbStore } from './src/db/dbStore.js';
import { Complaint, ComplaintCategory, PriorityLevel, SeverityLevel, User } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Body parser with 50mb limit for base64 image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Google Gen AI securely
const apiKey = process.env.GEMINI_API_KEY || '';
const hasApiKey = !!apiKey && apiKey !== 'MY_GEMINI_API_KEY';

let ai: GoogleGenAI | null = null;
if (hasApiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// WhatsApp Log tracking for Live Dashboard Simulation
export interface WhatsAppLog {
  id: string;
  phone: string;
  message: string;
  ticketNumber: string;
  timestamp: string;
}

export const whatsappLogs: WhatsAppLog[] = [];

export function logWhatsAppNotification(phone: string, message: string, ticketNumber: string) {
  const newLog: WhatsAppLog = {
    id: `wa-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    phone: phone || '+91 98765 43210',
    message,
    ticketNumber: ticketNumber || 'SECA-SYSTEM',
    timestamp: new Date().toISOString()
  };
  whatsappLogs.unshift(newLog);
  console.log(`[WhatsApp Simulator] Message sent to ${newLog.phone}: ${message}`);
}

// Helper to secure endpoints and simulate session/token validation
const getSessionUser = (req: Request): User | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  if (token === 'token-consumer') return dbStore.getUserById('usr-consumer') || null;
  if (token === 'token-engineer') return dbStore.getUserById('usr-engineer') || null;
  if (token === 'token-admin') return dbStore.getUserById('usr-admin') || null;
  
  // Try checking in store if custom user is logged in
  const customUser = dbStore.getUsers().find(u => `token-${u.id}` === token);
  return customUser || null;
};

// ----------------------------------------------------
// AUTHENTICATION ENDPOINTS
// ----------------------------------------------------

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = dbStore.getUserByEmail(email);
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials. Try consumer@seca.in, engineer@seca.in, or admin@seca.in.' });
    return;
  }

  // Accept any password as "password" for local preview ease
  if (password !== 'password') {
    res.status(401).json({ error: 'Incorrect password. Hint: Use "password".' });
    return;
  }

  res.json({
    user,
    token: `token-${user.id}`,
  });
});

app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, phone, role, consumerId, state, district } = req.body;
  
  if (!name || !email || !phone) {
    res.status(400).json({ error: 'Name, email, and phone are required.' });
    return;
  }

  const existing = dbStore.getUserByEmail(email);
  if (existing) {
    res.status(400).json({ error: 'Email already registered.' });
    return;
  }

  const newUser: User = {
    id: `usr-${Date.now()}`,
    name,
    email,
    phone,
    role: role || 'consumer',
    consumerId: role === 'consumer' ? (consumerId || `CON-GEN-${Math.floor(1000000 + Math.random() * 9000000)}`) : undefined,
    state: state || 'Delhi',
    district: district || 'West Delhi',
  };

  dbStore.addUser(newUser);

  res.status(201).json({
    user: newUser,
    token: `token-${newUser.id}`,
  });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  res.json({ user });
});

// ----------------------------------------------------
// AI COMPLAINT ANALYSIS ENGINE (GEMINI)
// ----------------------------------------------------

app.post('/api/ai/analyze', async (req: Request, res: Response) => {
  const { text, image, voiceTranscript } = req.body;

  const description = text || voiceTranscript || '';
  if (!description && !image) {
    res.status(400).json({ error: 'Please provide complaint text, voice transcription, or an image.' });
    return;
  }

  // Robust, realistic fallback diagnostics if Gemini API Key is missing
  if (!ai) {
    console.log('No GEMINI_API_KEY detected. Utilizing built-in local heuristic AI models.');
    
    // Simple heuristic classifier
    let category: ComplaintCategory = 'Power Outage';
    let severity: SeverityLevel = 'Medium';
    let priority: PriorityLevel = 'Medium';
    let department = 'Power Supply Maintenance';
    let summary = 'Electricity supply issue reported.';
    let safety: string[] = ['Maintain general distance from electrical wires.', 'Turn off household mains during outages to avoid voltage surges.'];
    let engineerSummary = 'Inspect local power lines and household connection cables.';

    const lower = description.toLowerCase();
    if (lower.includes('spark') || lower.includes('transformer') || lower.includes('smoke') || lower.includes('blast')) {
      category = 'Transformer Damage';
      severity = 'Critical';
      priority = 'Immediate';
      department = 'Transformers & Substations';
      summary = 'Sparks and smoke observed from local substation transformer.';
      safety = [
        'Maintain a distance of at least 25 meters from the smoking transformer.',
        'DO NOT throw water on any electrical fire.',
        'Notify your neighborhood to disconnect high-load appliances.'
      ];
      engineerSummary = 'URGENT: Shutdown feeder, inspect transformer winding, measure oil temperature, and check for leakage.';
    } else if (lower.includes('hanging') || lower.includes('pole') || lower.includes('wire') || lower.includes('broken')) {
      category = lower.includes('pole') ? 'Broken Pole' : 'Hanging Wire';
      severity = 'Critical';
      priority = 'Immediate';
      department = 'Overhead Lines & Poles';
      summary = 'Dangling electrical conductor wire reported hanging dangerously low over public space.';
      safety = [
        'STAY AWAY from hanging wires at all costs.',
        'Warn others and keep animals/vehicles clear of the wet road or metal fences.',
        'Wait for physical lineman inspection.'
      ];
      engineerSummary = 'Safely isolate the line segment. Resplice overhead cable, tension line, and install structural pole clamps.';
    } else if (lower.includes('meter') || lower.includes('burnt') || lower.includes('reading')) {
      category = lower.includes('burnt') ? 'Burnt Meter' : 'Meter Not Working';
      severity = 'High';
      priority = 'High';
      department = 'Metering & Billing';
      summary = 'Home electricity meter burnt/damaged causing individual power failure.';
      safety = [
        'Do not touch the physical meter box or open breaker terminals.',
        'Ensure the household interior has no active smell of plastic fire.'
      ];
      engineerSummary = 'Uninstall damaged static meter, verify incoming current phase, and commission a brand-new smart digital meter.';
    } else if (lower.includes('bill') || lower.includes('dispute') || lower.includes('charge')) {
      category = 'Billing Issue';
      severity = 'Low';
      priority = 'Low';
      department = 'Metering & Billing';
      summary = 'Anomalous billing statement discrepant with current digital meter reading.';
      safety = ['Verify current digital reading and keep copies of your past 3 months electricity bills.'];
      engineerSummary = 'Cross-examine meter reading logs and submit request to ledger rectifying department.';
    } else if (lower.includes('shock') || lower.includes('current') || lower.includes('hazard')) {
      category = 'Electric Shock Hazard';
      severity = 'Critical';
      priority = 'Immediate';
      department = 'Overhead Lines & Poles';
      summary = 'Leakage of current detected on physical street light pole or public structural poles.';
      safety = [
        'Avoid touching any public pole or metallic structures, especially in rainy or wet conditions.',
        'Inform pedestrians to keep away.'
      ];
      engineerSummary = 'Check insulation resistance using megger. Inspect grounding loop wire connection. Replace failed joint isolators.';
    }

    res.json({
      category,
      priority,
      severity,
      department,
      summary,
      safety,
      confidence: 85,
      duplicateDetected: false,
      engineerSummary
    });
    return;
  }

  try {
    const systemPrompt = `You are the core intelligence of the Smart Electricity Complaint Assistant (SECA), helping Indian power consumers classify complaints.
Your output must be a valid structured JSON matching the requested schema.

Supported Complaint Categories:
- Power Outage
- Low Voltage
- High Voltage
- Transformer Damage
- Burnt Meter
- Broken Pole
- Hanging Wire
- Street Light Failure
- Electric Shock Hazard
- Billing Issue
- Meter Not Working
- Illegal Connection

Supported Departments:
- Overhead Lines & Poles (for hanging wires, poles, shocks, illegal connections)
- Transformers & Substations (for transformer damage, heavy voltage outages)
- Metering & Billing (for burnt meters, billing issues, meter malfunction)
- Street Lighting (for street light failures)

Assign:
- Severity Level (Low, Medium, High, Critical)
- Priority Level (Low, Medium, High, Immediate)

Write a concise consumer-facing summary, bullet-point safety actions, and a technical breakdown (engineerSummary) for field engineers on how to fix this issue on the ground.`;

    const contentParts: any[] = [];
    if (image) {
      // Extract MIME type and pure base64 data from DataURL
      const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (matches) {
        contentParts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2],
          },
        });
      }
    }

    if (description) {
      contentParts.push({ text: `Analyze this electricity complaint details: "${description}"` });
    } else if (image) {
      contentParts.push({ text: "Analyze this uploaded image and generate a complete electrical complaint report." });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contentParts,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['category', 'priority', 'severity', 'department', 'summary', 'safety', 'confidence', 'engineerSummary'],
          properties: {
            category: {
              type: Type.STRING,
              description: 'Strictly one of the supported complaint categories.'
            },
            priority: {
              type: Type.STRING,
              description: 'Low, Medium, High, or Immediate.'
            },
            severity: {
              type: Type.STRING,
              description: 'Low, Medium, High, or Critical.'
            },
            department: {
              type: Type.STRING,
              description: 'One of the supported department names.'
            },
            summary: {
              type: Type.STRING,
              description: 'A professional consumer-facing summary of what is wrong.'
            },
            safety: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of actionable safety instructions (what NOT to touch, distances, precautions).'
            },
            confidence: {
              type: Type.INTEGER,
              description: 'Confidence rating percentage of diagnosis (0 to 100).'
            },
            engineerSummary: {
              type: Type.STRING,
              description: 'Technical task instructions for the dispatched lineman/engineer to safely rectify the fault.'
            }
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    
    // Simulate duplicate detection
    const allComplaints = dbStore.getComplaints();
    const isDuplicate = allComplaints.some(
      c => c.category === parsed.category && 
           c.status !== 'Resolved' && 
           c.status !== 'Closed' &&
           Math.abs((c.location.latitude || 0) - (req.body.latitude || 28.61)) < 0.005
    );

    let duplicateTicketNumber;
    if (isDuplicate) {
      const match = allComplaints.find(
        c => c.category === parsed.category && c.status !== 'Resolved' && c.status !== 'Closed'
      );
      duplicateTicketNumber = match?.ticketNumber;
    }

    res.json({
      ...parsed,
      duplicateDetected: isDuplicate,
      duplicateTicketNumber,
    });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'AI analysis pipeline failed. Please retry.' });
  }
});

// ----------------------------------------------------
// REST APIS FOR COMPLAINTS
// ----------------------------------------------------

// GET /api/complaints
app.get('/api/complaints', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const { search, category, status, severity } = req.query;

  // Consumers can only view their own complaints, unless they are admin/engineer
  const consumerId = user.role === 'consumer' ? user.consumerId : undefined;
  const engineerId = user.role === 'engineer' ? user.id : undefined;

  const list = dbStore.getComplaints({
    search: search as string,
    category: category as string,
    status: status as string,
    severity: severity as string,
    consumerId,
    engineerId,
  });

  res.json(list);
});

// GET /api/complaints/:id
app.get('/api/complaints/:id', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const complaint = dbStore.getComplaintById(req.params.id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found.' });
    return;
  }

  // Enforcement check: consumers can only read their own
  if (user.role === 'consumer' && complaint.consumerId !== user.consumerId) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  const logs = dbStore.getStatusLogs(complaint.id);

  res.json({
    ...complaint,
    timeline: logs,
  });
});

// POST /api/complaints
app.post('/api/complaints', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const { category, description, location, imageUrl, voiceUrl, severity, priority, department, aiAnalysis } = req.body;

  if (!category || !description) {
    res.status(400).json({ error: 'Category and description are required.' });
    return;
  }

  const ticketNumber = `SECA-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  const newComplaint: Complaint = {
    id: `comp-${Date.now()}`,
    ticketNumber,
    consumerId: user.consumerId || 'CON-GUEST',
    consumerName: user.name,
    consumerPhone: user.phone,
    category,
    description,
    location: location || { address: 'Delhi, India' },
    imageUrl,
    voiceUrl,
    status: 'Submitted',
    severity: severity || 'Medium',
    priority: priority || 'Medium',
    department: department || 'General Maintenance',
    aiAnalysis,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Auto assignment trigger for testing
  if (newComplaint.severity === 'Critical' || newComplaint.priority === 'Immediate') {
    const overheadEngineer = dbStore.getEngineers().find(e => e.department.toLowerCase().includes('overhead') || e.department.toLowerCase().includes('pole'));
    if (overheadEngineer) {
      newComplaint.engineerId = overheadEngineer.id;
      newComplaint.engineerName = overheadEngineer.name;
      newComplaint.status = 'Assigned';
    }
  }

  dbStore.addComplaint(newComplaint);

  // Trigger simulated WhatsApp notification on creation
  const waMsg = `Dear ${newComplaint.consumerName}, your complaint for "${newComplaint.category}" is filed. Ticket No: ${newComplaint.ticketNumber}. Current Status: ${newComplaint.status}. Track: http://seca.in/t/${newComplaint.id}`;
  logWhatsAppNotification(newComplaint.consumerPhone, waMsg, newComplaint.ticketNumber);

  res.status(201).json(newComplaint);
});

// PATCH /api/complaints/:id
app.patch('/api/complaints/:id', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  // Verification: Consumers cannot update other details besides closing
  if (user.role === 'consumer') {
    const complaint = dbStore.getComplaintById(req.params.id);
    if (!complaint || complaint.consumerId !== user.consumerId) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    // Consumers can only close their tickets
    if (req.body.status && req.body.status !== 'Closed') {
      res.status(403).json({ error: 'Consumers can only mark status as Closed.' });
      return;
    }
  }

  const updated = dbStore.updateComplaint(
    req.params.id,
    req.body,
    user.id,
    `${user.name} (${user.role.toUpperCase()})`
  );

  if (!updated) {
    res.status(404).json({ error: 'Complaint not found.' });
    return;
  }

  // Trigger simulated WhatsApp notification on updates
  const updateWaMsg = `Dear ${updated.consumerName}, your ticket ${updated.ticketNumber} status is updated to "${updated.status}"${updated.engineerName ? ` (Lineman: ${updated.engineerName})` : ''}. Track: http://seca.in/t/${updated.id}`;
  logWhatsAppNotification(updated.consumerPhone, updateWaMsg, updated.ticketNumber);

  res.json(updated);
});

// DELETE /api/complaints/:id
app.delete('/api/complaints/:id', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Admin role is required to delete.' });
    return;
  }

  const success = dbStore.deleteComplaint(req.params.id);
  if (!success) {
    res.status(404).json({ error: 'Complaint not found.' });
    return;
  }

  res.json({ success: true, message: 'Ticket successfully deleted.' });
});

// ----------------------------------------------------
// SYSTEM OTHER APIs
// ----------------------------------------------------

app.get('/api/engineers', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || user.role === 'consumer') {
    res.status(403).json({ error: 'Restricted to Admin & Engineers.' });
    return;
  }
  res.json(dbStore.getEngineers());
});

app.get('/api/notifications', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  res.json(dbStore.getNotifications(user.id));
});

app.post('/api/notifications/read', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  dbStore.markNotificationsAsRead(user.id);
  res.json({ success: true });
});

app.get('/api/analytics', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || user.role === 'consumer') {
    res.status(403).json({ error: 'Access restricted to authorized staff.' });
    return;
  }
  res.json(dbStore.getAnalyticsSummary());
});

// Standard mock upload route (returns base64 as DataURL immediately for seamless state storage)
app.post('/api/upload', (req: Request, res: Response) => {
  const { fileData, fileName } = req.body;
  if (!fileData) {
    res.status(400).json({ error: 'No file data received.' });
    return;
  }
  // Return the base64 URL directly, which the client can use as imageUrl
  res.json({
    url: fileData,
    success: true,
  });
});

// Voice transcription route
app.post('/api/voice', async (req: Request, res: Response) => {
  const { voiceBase64 } = req.body;
  if (!voiceBase64) {
    res.status(400).json({ error: 'Voice audio is required.' });
    return;
  }

  if (!ai) {
    // Simulated Voice-to-Text Fallback if Gemini key is missing
    const simulatedTranscripts = [
      "There is a hanging wire near my society block gate number three, children play here, it is extremely dangerous.",
      "Our building transformer has caught fire with sparks flying, there is heavy black smoke and power is cut.",
      "The street light is not working in our sector market lane, it is completely pitch dark after sunset."
    ];
    const transcript = simulatedTranscripts[Math.floor(Math.random() * simulatedTranscripts.length)];
    res.json({ transcript });
    return;
  }

  try {
    // Analyze sound bytes using Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'audio/mp3',
            data: voiceBase64
          }
        },
        { text: 'Transcribe this electrical complaints voice message into clear Indian English text. Only return the transcript, no metadata.' }
      ]
    });

    res.json({ transcript: response.text?.trim() });
  } catch (error) {
    console.error('Gemini Voice Error:', error);
    res.status(500).json({ error: 'Speech-to-text processing failed. Please type manually.' });
  }
});

// ----------------------------------------------------
// AI FAQ CHATBOT & WHATSAPP LOGS ENDPOINTS
// ----------------------------------------------------

// GET /api/whatsapp/logs
app.get('/api/whatsapp/logs', (req: Request, res: Response) => {
  res.json(whatsappLogs);
});

// POST /api/chat
app.post('/api/chat', async (req: Request, res: Response) => {
  const { message, history } = req.body;
  if (!message) {
    res.status(400).json({ error: 'Message is required.' });
    return;
  }

  const systemPrompt = `You are "SECA AI Assistant", a smart electricity helpline assistant representing regional Indian utility distribution companies. 
Your tone should be highly professional, polite, reassuring, and solution-oriented.
Answer any electricity-related questions (such as how to report outages, how to dispute bills, safety tips, tariff rates, etc.) clearly and briefly.
For billing: Indian domestic slab rates are:
- 0 to 200 units: ₹3.00 per unit
- 201 to 400 units: ₹4.50 per unit
- Above 400 units: ₹6.50 per unit
For safety: Always warn users NEVER to touch snaps wires or wet poles, and maintain a 10m safe radius.
CRITICAL CAPABILITY: If the user is describing an electrical fault or complaint they want to file (e.g. "I see sparks in the transformer near Sector 4", "streetlights are off on block C", "low voltage at home"), you must end your response by suggesting they file a ticket, AND append a special hidden tag exactly formatted as: 
[AUTO_FILL: {"category": "<MATCHING_CATEGORY>", "description": "<EXTRACTED_DESCRIPTION>"}]
Choose from these exact categories: Power Outage, Low Voltage, High Voltage, Transformer Damage, Burnt Meter, Broken Pole, Hanging Wire, Street Light Failure, Electric Shock Hazard, Billing Issue, Meter Not Working, Illegal Connection.
Example: "I can help you file that. [AUTO_FILL: {"category": "Transformer Damage", "description": "Sparking and smoke on local transformer"}]"`;

  if (!ai) {
    // Simulated intelligent responses if Gemini key is missing
    const msgLower = message.toLowerCase();
    let reply = "I would be happy to help you with that! ";
    
    if (msgLower.includes('bill') || msgLower.includes('charge') || msgLower.includes('rate') || msgLower.includes('slab')) {
      reply += "Indian electricity billing usually follows a slab structure: 0-200 units are billed at ₹3.00/unit, 201-400 at ₹4.50/unit, and units above 400 at ₹6.50/unit. If your bill is unusually high, please take a photo of your meter and file a 'Billing Issue' complaint in our portal.";
    } else if (msgLower.includes('spark') || msgLower.includes('fire') || msgLower.includes('transformer') || msgLower.includes('smoke')) {
      reply += "This sounds like a dangerous hazard! Please stay at least 25 meters away from the area. Do NOT throw water. I have extracted the details and can pre-fill a 'Transformer Damage' report for you. Please click the prefill button below! [AUTO_FILL: {\"category\": \"Transformer Damage\", \"description\": \"" + message.replace(/"/g, '\\"') + "\"} ]";
    } else if (msgLower.includes('outage') || msgLower.includes('no power') || msgLower.includes('electricity cut')) {
      reply += "I'm sorry for the inconvenience. Outages can be reported under 'Power Outage'. I have extracted this for you. Click below to prefill! [AUTO_FILL: {\"category\": \"Power Outage\", \"description\": \"" + message.replace(/"/g, '\\"') + "\"} ]";
    } else if (msgLower.includes('wire') || msgLower.includes('hanging') || msgLower.includes('snapped') || msgLower.includes('pole')) {
      reply += "WARNING: Snapped or hanging wires are extremely hazardous, especially in wet weather. Maintain at least 15 meters distance! I've prefilled a high-priority ticket for you. [AUTO_FILL: {\"category\": \"Hanging Wire\", \"description\": \"" + message.replace(/"/g, '\\"') + "\"} ]";
    } else if (msgLower.includes('status') || msgLower.includes('ticket')) {
      reply += "You can track any active complaint live from your 'My Complaints' panel! Simply click 'View Details' on any ticket to view its real-time technician workload, assigned engineer details, and vertical timeline updates.";
    } else {
      reply += "Thank you for contacting SECA Support. For safety, always avoid contact with metallic street light poles in rainy weather. You can report outages, transformer sparks, burnt meters, or street light failures easily. What issue are you facing today?";
    }

    res.json({ text: reply });
    return;
  }

  try {
    // Format conversation history for Gemini if present
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      history.slice(-6).forEach((h: any) => {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        });
      });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7
      }
    });

    res.json({ text: response.text || 'I am ready to help you with any grid-related query.' });
  } catch (error) {
    console.error('Gemini Chat Error:', error);
    res.status(500).json({ error: 'AI Chatbot is currently taking a breather. Please type manually.' });
  }
});

// ----------------------------------------------------
// VITE CLIENT DEV AND PRODUCTION ROUTING
// ----------------------------------------------------

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SECA] Backend operational on http://0.0.0.0:${PORT}`);
    console.log(`[SECA] AI Engine: ${hasApiKey ? 'Gemini 3.5 Active' : 'Offline Intelligent Fallbacks Enabled'}`);
  });
}

start();
