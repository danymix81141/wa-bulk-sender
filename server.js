// server.js - Versione Potenziata e Corretta con Debugging (Final Fix)

console.log('Server script started.');

process.on('uncaughtException', (err) => {
    console.error('Unhandled Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import whatsAppWeb from 'whatsapp-web.js';
const { Client, LocalAuth } = whatsAppWeb;
import qrcode from 'qrcode';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs/promises';
import { existsSync, rmSync } from 'fs';
import { Readable } from 'stream';

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const SESSION_FILE_PATH = './.wwebjs_auth';
const ADDRESS_BOOK_FILE = path.join(__dirname, 'address_book.json');
const APPOINTMENTS_FILE = path.join(__dirname, 'appointments.json');
const SERVICES_FILE = path.join(__dirname, 'services.json'); // Nuovo file per i servizi
const HAIRDRESSER_WHATSAPP_NUMBER = '+393516664222';

// --- Express App & WebSocket Server ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

app.use(express.static(path.join(__dirname, 'dist'))); 
app.use(express.json());

// --- In-memory storage & persistence ---
let services = [];
let scheduledMessages = []; 
let nextJobId = 1;
let internalAddressBook = new Map();
let recentSenders = new Set();
const RECENT_SENDERS_MAX_SIZE = 50;

// --- Persistence Functions ---
async function loadData(filePath, defaultData = []) {
    try {
        if (existsSync(filePath)) {
            const data = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(data);
        } else {
            await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
    } catch (error) {
        console.error(`Error loading data from ${filePath}:`, error);
        return defaultData;
    }
}

async function saveData(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error saving data to ${filePath}:`, error);
    }
}

async function initializeData() {
    services = await loadData(SERVICES_FILE, []);
    const contacts = await loadData(ADDRESS_BOOK_FILE, []);
    internalAddressBook = new Map(contacts.map(c => [c.number, c]));
    
    const loadedJobs = await loadData(APPOINTMENTS_FILE, []);
    scheduledMessages = loadedJobs.map(job => {
        job.dateTime = new Date(job.dateTime);
        job.endDateTime = new Date(job.endDateTime);
        return job;
    });

    scheduledMessages.forEach(job => {
        if (job.jobType !== 'appointment' && job.status === 'pending' && job.dateTime.getTime() > new Date().getTime()) {
            const delay = job.dateTime.getTime() - new Date().getTime();
            job.timeoutId = setTimeout(async () => {
                try {
                    await handleSendMessage({ numbers: job.numbers, message: job.message });
                    job.status = 'sent';
                    console.log(`Successfully sent scheduled message job #${job.id}.`);
                } catch (error) {
                    console.error(`Failed to send scheduled message job #${job.id}:`, error);
                }
                broadcast({ type: 'schedule_update' });
                saveData(APPOINTMENTS_FILE, scheduledMessages.map(({ timeoutId, ...j }) => j));
            }, delay);
        } else if (job.jobType !== 'appointment' && job.status === 'pending' && job.dateTime.getTime() <= new Date().getTime()) {
            job.status = 'skipped_past';
        }
    });

    const maxId = scheduledMessages.reduce((max, job) => Math.max(max, job.id || 0), 0);
    nextJobId = maxId + 1;
    console.log(`Loaded ${services.length} services, ${internalAddressBook.size} contacts, and ${scheduledMessages.length} appointments.`);
}

// --- WhatsApp Client Management (No changes here, keeping it concise) ---
let client;
let isAuthenticated = false;
let qrCodeDataUrl = '';
let statusMessage = 'Initializing...';

const broadcast = (data) => {
    wss.clients.forEach((wsClient) => {
        if (wsClient.readyState === 1) { // WebSocket.OPEN
            wsClient.send(JSON.stringify(data));
        }
    });
};

const updateStatus = (message) => {
    statusMessage = message;
    console.log(`Status: ${message}`);
    broadcast({ type: 'status_update', message });
};

const initializeWhatsAppClient = () => {
    console.log('Initializing WhatsApp client...');
    client = new Client({
        authStrategy: new LocalAuth({ dataPath: SESSION_FILE_PATH }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
    });

    client.on('qr', async (qr) => {
        qrCodeDataUrl = await qrcode.toDataURL(qr);
        isAuthenticated = false;
        updateStatus('Please scan the QR code to log in.');
        broadcast({ type: 'qr_code', url: qrCodeDataUrl });
    });

    client.on('ready', () => {
        console.log('Client is ready!');
        qrCodeDataUrl = '';
        isAuthenticated = true;
        updateStatus('User authenticated successfully!');
        broadcast({ type: 'authenticated' });
    });
    
    client.on('message', async (message) => {
        if(message.fromMe) return;
        const senderNumber = message.from.split('@')[0];
        if (senderNumber) {
            recentSenders.delete(senderNumber);
            recentSenders.add(senderNumber);
            if (recentSenders.size > RECENT_SENDERS_MAX_SIZE) {
                const oldest = recentSenders.values().next().value;
                recentSenders.delete(oldest);
            }
        }
    });

    client.on('loading_screen', (percent, message) => updateStatus(`Loading: ${percent}% - ${message || 'Please wait...'}`));
    client.on('authenticated', () => { isAuthenticated = true; });
    client.on('auth_failure', (msg) => updateStatus('Authentication failed. Please restart and try again.'));
    
    client.on('disconnected', (reason) => {
        console.log('Client was logged out:', reason);
        isAuthenticated = false;
        qrCodeDataUrl = '';
        updateStatus('You have been logged out. Re-initializing...');
        broadcast({ type: 'logged_out' });
        
        try {
            scheduledMessages.forEach(job => {
                if (job.timeoutId) clearTimeout(job.timeoutId);
            });
            scheduledMessages = [];
            if (existsSync(SESSION_FILE_PATH)) {
                rmSync(SESSION_FILE_PATH, { recursive: true, force: true });
            }
            client.destroy().finally(initializeWhatsAppClient);
        } catch (e) {
            console.error("Error during client cleanup:", e);
            initializeWhatsAppClient();
        }
    });

    client.initialize().catch(err => updateStatus('Failed to initialize WhatsApp client.'));
};

wss.on('connection', (ws) => {
    console.log('Frontend client connected.');
    ws.send(JSON.stringify({ type: 'status_update', message: statusMessage }));
    if (isAuthenticated) ws.send(JSON.stringify({ type: 'authenticated' }));
    else if (qrCodeDataUrl) ws.send(JSON.stringify({ type: 'qr_code', url: qrCodeDataUrl }));
    
    ws.on('message', async (messageBuffer) => {
        const message = messageBuffer.toString();
        try {
            const data = JSON.parse(message);
            if (data.type === 'send_message') await handleSendMessage(data.payload);
            if (data.type === 'logout' && client) await client.logout();
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => console.log('Frontend client disconnected.'));
});

async function handleSendMessage(payload) {
    const { numbers, message } = payload;
    const numberList = numbers.split(',').map(n => n.trim()).filter(n => n);
    if (!message || numberList.length === 0) return updateStatus('Error: Numbers or message content is missing.');
    updateStatus(`Sending to ${numberList.length} numbers...`);
    let sentCount = 0, failedCount = 0;
    for (const number of numberList) {
        try {
            await client.sendMessage(`${number.replace(/\D/g, '')}@c.us`, message);
            sentCount++;
            updateStatus(`Sent to ${number} (${sentCount}/${numberList.length})`);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2500 + 1500));
        } catch (err) {
            failedCount++;
            updateStatus(`Failed to send to ${number} (${sentCount}/${numberList.length})`);
        }
    }
    updateStatus(`Finished. Sent: ${sentCount}, Failed: ${failedCount}.`);
}


// --- API Endpoints ---
app.get('/api/public/appointments', (req, res) => {
    const publicAppointments = scheduledMessages
        .filter(job => job.jobType === 'appointment')
        .map(job => ({
            id: job.id,
            dateTime: job.dateTime,
            endDateTime: job.endDateTime,
            message: 'Occupato'
        }));
    res.json(publicAppointments);
});

app.post('/api/public/appointments', async (req, res) => {
    const { contact, dateTime, endDateTime, message } = req.body;
    if (!contact || !contact.name || !contact.number || !dateTime || !endDateTime || !message) {
        return res.status(400).json({ message: 'Dati della prenotazione incompleti.' });
    }

    const mainJob = scheduleJob({
        dateTime: dateTime,
        endDateTime: endDateTime,
        numbers: contact.number,
        message: message,
        jobType: 'appointment',
        contactName: contact.name,
        contactNumber: contact.number,
    });

    if (!mainJob) {
        return res.status(500).json({ message: 'Impossibile programmare l\'appuntamento.' });
    }
    
    await saveData(APPOINTMENTS_FILE, scheduledMessages);

    const responseJob = { ...mainJob };
    delete responseJob.timeoutId;

    res.status(201).json({ message: 'Appuntamento prenotato con successo!', appointment: responseJob });

    if (client && isAuthenticated) {
        const notificationMessage = `*Nuovo Appuntamento!*\n\nCliente: ${contact.name}\nTelefono: ${contact.number}\nServizi: ${message.split(': ')[1] || 'Non specificato'}\nData: ${new Date(dateTime).toLocaleDateString('it-IT')}\nOra: ${new Date(dateTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}*\n\nControlla il calendario per i dettagli.`;
        
        try {
            await client.sendMessage(`${HAIRDRESSER_WHATSAPP_NUMBER.replace(/\D/g, '')}@c.us`, notificationMessage);
            console.log('WhatsApp notification sent to hairdresser.');
        } catch (error) {
            console.error('Failed to send WhatsApp notification to hairdresser:', error);
        }

        const clientMessage = `Ciao ${contact.name}! 👋\n\nTi confermo il tuo appuntamento presso Hair-stylist Valeria.\n\n*Servizi:* ${message.split(': ')[1] || 'Non specificato'}\n*Quando:* ${new Date(dateTime).toLocaleDateString('it-IT')} alle ${new Date(dateTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}\n\nTi aspettiamo! Per qualsiasi modifica, non esitare a rispondere a questo messaggio.`;
        try {
            await client.sendMessage(`${contact.number.replace(/\D/g, '')}@c.us`, clientMessage);
            console.log(`WhatsApp confirmation sent to client: ${contact.number}`);
        } catch (error) {
            console.error(`Failed to send WhatsApp confirmation to client ${contact.number}:`, error);
        }
    }
});

app.delete('/api/appointments/:id', async (req, res) => {
    if (!isAuthenticated) return res.status(403).json({ message: 'WhatsApp client not authenticated.' });

    const { id } = req.params;
    const appointmentId = parseInt(id, 10);

    if (isNaN(appointmentId)) {
        return res.status(400).json({ message: 'Invalid appointment ID.' });
    }

    const jobsToDelete = scheduledMessages.filter(
        job => job.id === appointmentId || job.parentJobId === appointmentId
    );

    if (jobsToDelete.length === 0) {
        return res.status(404).json({ message: 'Appointment not found.' });
    }

    jobsToDelete.forEach(job => {
        if (job.timeoutId) {
            clearTimeout(job.timeoutId);
        }
    });

    scheduledMessages = scheduledMessages.filter(
        job => job.id !== appointmentId && job.parentJobId !== appointmentId
    );

    await saveData(APPOINTMENTS_FILE, scheduledMessages);

    console.log(`Deleted appointment ${appointmentId} and its associated reminders.`);
    res.status(200).json({ message: 'Appointment deleted successfully.' });
});

app.get('/api/whatsapp-contacts', async (req, res) => {
    if (!isAuthenticated || !client) {
        return res.status(403).json({ message: 'WhatsApp client not authenticated.' });
    }
    try {
        const chats = await client.getChats();
        const contacts = chats
            .filter(chat => !chat.isGroup && chat.name && chat.id.user)
            .map(chat => ({
                name: chat.name,
                number: chat.id.user
            }));
        res.json({ contacts });
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ message: 'Failed to fetch contacts from WhatsApp.' });
    }
});

app.get('/api/address-book', (req, res) => {
    res.json(Array.from(internalAddressBook.values()));
});

app.post('/api/address-book', async (req, res) => {
    const contactsToAdd = req.body.contacts;
    if (!Array.isArray(contactsToAdd)) {
        return res.status(400).json({ message: 'Invalid payload. Expected an array of contacts.' });
    }
    let addedCount = 0;
    contactsToAdd.forEach(contact => {
        if (contact.number && contact.name && !internalAddressBook.has(contact.number)) {
            internalAddressBook.set(contact.number, contact);
            addedCount++;
        }
    });
    if (addedCount > 0) {
        await saveData(ADDRESS_BOOK_FILE, Array.from(internalAddressBook.values()));
    }
    res.status(201).json({ message: `${addedCount} contacts added successfully.`, contacts: Array.from(internalAddressBook.values()) });
});


app.get('/api/recent-numbers', (req, res) => {
    const count = parseInt(req.query.count, 10) || 20;
    const numbers = Array.from(recentSenders).reverse().slice(0, count);
    res.json({ numbers });
});

app.get('/api/services', (req, res) => {
    res.json(services);
});

app.get('/api/scheduled-messages', (req, res) => {
    const responseJobs = scheduledMessages.map(({timeoutId, ...job}) => job);
    res.json(responseJobs.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()));
});

const scheduleJob = (jobDetails) => {
    const now = new Date();
    const scheduleDate = new Date(jobDetails.dateTime);
    const delay = scheduleDate.getTime() - now.getTime();

    if (delay < 0 && jobDetails.jobType !== 'appointment') {
        console.log(`Skipping past job: ${jobDetails.message}`);
        return null;
    }

    const jobId = jobDetails.id ?? nextJobId++;
    const job = { ...jobDetails, id: jobId, status: 'pending' };
    nextJobId = Math.max(nextJobId, jobId + 1);

    if(delay > 0 && job.jobType !== 'appointment') {
        job.timeoutId = setTimeout(async () => {
            try {
                if (new Date(job.dateTime) > new Date()) {
                    await handleSendMessage({ numbers: job.numbers, message: job.message });
                    job.status = 'sent';
                    console.log(`Successfully sent scheduled message job #${job.id}.`);
                } else {
                    job.status = 'skipped_past';
                }
            } catch (error) {
                console.error(`Failed to send scheduled message job #${job.id}:`, error);
            }
            broadcast({ type: 'schedule_update' });
            saveData(APPOINTMENTS_FILE, scheduledMessages.map(({ timeoutId, ...j }) => j));
        }, delay);
    } else if (job.jobType === 'appointment') {
        job.status = 'past';
    }
    
    scheduledMessages.push(job);
    return job;
};

app.post('/api/schedule-appointment', async (req, res) => {
    if (!isAuthenticated) return res.status(403).json({ message: 'WhatsApp client not authenticated.' });

    const { appointment, reminders } = req.body;
    if (!appointment || !appointment.contact || !appointment.dateTime || !appointment.message) {
        return res.status(400).json({ message: 'Missing appointment details.' });
    }
    
    if (appointment.id) {
        const appointmentId = appointment.id;
        const jobsToCancel = scheduledMessages.filter(
            job => job.id === appointmentId || job.parentJobId === appointmentId
        );
        
        jobsToCancel.forEach(job => {
            if (job.timeoutId) {
                clearTimeout(job.timeoutId);
            }
        });
        
        scheduledMessages = scheduledMessages.filter(
            job => job.id !== appointmentId && job.parentId !== appointmentId
        );
        await saveData(APPOINTMENTS_FILE, scheduledMessages);
        console.log(`Updated appointment ${appointmentId}: Cancelled ${jobsToCancel.length} old jobs.`);
    }

    const mainJob = scheduleJob({
        id: appointment.id,
        dateTime: appointment.dateTime,
        endDateTime: appointment.endDateTime,
        numbers: appointment.contact.number,
        message: appointment.message,
        jobType: 'appointment',
        contactName: appointment.contact.name,
        contactNumber: appointment.contact.number,
        serviceIds: appointment.serviceIds, // Save service IDs
        totalCost: appointment.totalCost,   // Save total cost
    });
    
    if (!mainJob) {
        return res.status(400).json({ message: 'Cannot schedule an appointment in the past.' });
    }

    await saveData(APPOINTMENTS_FILE, scheduledMessages);

    if (Array.isArray(reminders)) {
        reminders.forEach(reminder => {
            if (!reminder.value || !reminder.unit || !reminder.at) return;
            
            const reminderDate = new Date(appointment.dateTime);
            const [hours, minutes] = String(reminder.at).split(':').map(Number);
            
            if (reminder.unit === 'days') {
                reminderDate.setDate(reminderDate.getDate() - parseInt(reminder.value, 10));
            } else if (reminder.unit === 'hours') {
                reminderDate.setHours(reminderDate.getHours() - parseInt(reminder.value, 10));
            } else {
                return;
            }

            reminderDate.setHours(hours, minutes, 0, 0);

            const unitText = reminder.unit === 'days' ? (reminder.value > 1 ? 'giorni' : 'giorno') : (reminder.value > 1 ? 'ore' : 'ora');
            const reminderMessage = `PROMEMORIA: Il tuo appuntamento è tra circa ${reminder.value} ${unitText}.`;

            scheduleJob({
                dateTime: reminderDate.toISOString(),
                numbers: appointment.contact.number,
                message: reminderMessage,
                jobType: 'reminder',
                parentJobId: mainJob.id,
                contactName: appointment.contact.name,
                reminderDetails: {
                    value: reminder.value,
                    unit: reminder.unit,
                    at: reminder.at
                }
            });
        });
    }

    const action = appointment.id ? 'updated' : 'scheduled';
    res.status(201).json({ message: `Appointment and reminders ${action} successfully.` });
});

const upload = multer({ storage: multer.memoryStorage() });
app.post('/upload', upload.single('phoneNumbersFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const numbers = [];
    Readable.from(req.file.buffer.toString('utf-8'))
        .pipe(csv({ headers: false }))
        .on('data', (row) => {
            const number = String(Object.values(row)[0] || '').trim();
            if (number && /^\\+?[1-9]\\d{6,14}$/.test(number)) numbers.push(number);
        })
        .on('end', () => res.json({ numbers }))
        .on('error', () => res.status(500).json({ message: 'Error processing the file.' }));
});

server.listen(PORT, async () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    await initializeData();
    initializeWhatsAppClient();
});
