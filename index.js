const express = require('express')
const QRCode = require('qrcode')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const cors = require('cors') // <-- tambah ini

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require('@whiskeysockets/baileys')

const app = express()
app.use(express.json())
app.use(cors())

const upload = multer({ dest: 'uploads/' })

let sock
let lastQR = null
let status = 'disconnected'

async function startWA() {
const { state, saveCreds } = await useMultiFileAuthState('./sessions')

sock = makeWASocket({
auth: state,
printQRInTerminal: false,
keepAliveIntervalMs: 30_000
})

sock.ev.on('creds.update', saveCreds)

sock.ev.on('connection.update', async (update) => {
const { qr, connection, lastDisconnect } = update

if (qr) {
lastQR = await QRCode.toDataURL(qr)
status = 'qr'
}

if (connection === 'open') {
status = 'connected'
lastQR = null
console.log('✅ WhatsApp connected')
}

if (connection === 'close') {
status = 'disconnected'
const shouldReconnect =
lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
if (shouldReconnect) startWA()
}
})
}

startWA()

/* ======================
QR Connection
====================== */
app.get('/qr', (req, res) => {
res.json({ status, qr: lastQR })
})

/* ======================
SEND TEXT / LINK
====================== */
app.post('/send/text', async (req, res) => {
const { number, message } = req.body

if (status !== 'connected') return res.status(400).json({ error: 'WA not connected' })

try {
await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message })
res.json({ success: true })
} catch (e) {
res.status(500).json({ error: e.message })
}
})

/* ======================
SEND IMAGE
====================== */
app.post('/send/image', upload.single('file'), async (req, res) => {
const { number, caption } = req.body

try {
await sock.sendMessage(`${number}@s.whatsapp.net`, {
image: fs.readFileSync(req.file.path),
caption
})
fs.unlinkSync(req.file.path)
res.json({ success: true })
} catch (e) {
res.status(500).json({ error: e.message })
}
})

/* ======================
SEND VIDEO
====================== */
app.post('/send/video', upload.single('file'), async (req, res) => {
const { number, caption } = req.body

try {
await sock.sendMessage(`${number}@s.whatsapp.net`, {
video: fs.readFileSync(req.file.path),
caption
})
fs.unlinkSync(req.file.path)
res.json({ success: true })
} catch (e) {
res.status(500).json({ error: e.message })
}
})

/* ======================
SEND DOCUMENT / FILE
====================== */
app.post('/send/document', upload.single('file'), async (req, res) => {
const { number } = req.body

try {
await sock.sendMessage(`${number}@s.whatsapp.net`, {
document: fs.readFileSync(req.file.path),
fileName: req.file.originalname,
mimetype: req.file.mimetype
})
fs.unlinkSync(req.file.path)
res.json({ success: true })
} catch (e) {
res.status(500).json({ error: e.message })
}
})

/* ======================
SEND AUDIO
====================== */
app.post('/send/audio', upload.single('file'), async (req, res) => {
const { number } = req.body

try {
await sock.sendMessage(`${number}@s.whatsapp.net`, {
audio: fs.readFileSync(req.file.path),
mimetype: req.file.mimetype || 'audio/mpeg',
ptt: true
})
fs.unlinkSync(req.file.path)
res.json({ success: true })
} catch (e) {
res.status(500).json({ error: e.message })
}
})

/* ======================
SEND LOCATION
====================== */
app.post('/send/location', async (req, res) => {
const { number, latitude, longitude, caption } = req.body

if (!number || !latitude || !longitude)
return res.status(400).json({ error: 'number, latitude, longitude required' })

try {
await sock.sendMessage(`${number}@s.whatsapp.net`, {
location: {
degreesLatitude: latitude,
degreesLongitude: longitude,
name: caption || ''
}
})
res.json({ success: true })
} catch (e) {
res.status(500).json({ error: e.message })
}
})

/* ======================
DISCONNECT / LOGOUT
====================== */
app.post('/disconnect', async (req, res) => {
    if (!sock) return res.status(400).json({ error: 'No active session' })

    try {
        // logout WA
        await sock.logout()

        // reset status
        status = 'disconnected'
        lastQR = null

        // hapus folder sessions
        const sessionPath = './sessions'
        if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true })
        }

        // start WA baru (otomatis QR muncul)
        await startWA()

        res.json({ success: true, message: 'WhatsApp disconnected and new session started. QR ready.' })
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})




/* ======================
START SERVER
====================== */
app.listen(3000, () => console.log('🚀 WA API running on http://localhost:3000'))
