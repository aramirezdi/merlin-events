const express  = require('express');
const path     = require('path');
const multer   = require('multer');
const fetch    = require('node-fetch');
const fs       = require('fs');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Archivos estáticos ──
app.use(express.static(path.join(__dirname), { index: false }));
app.use('/banners', express.static(path.join(__dirname, 'uploads', 'banners')));

// ── Crear carpeta de banners si no existe ──
const BANNERS_DIR = path.join(__dirname, 'uploads', 'banners');
if (!fs.existsSync(BANNERS_DIR)) fs.mkdirSync(BANNERS_DIR, { recursive: true });

// ── Multer para banners ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BANNERS_DIR),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `banner_${Date.now()}${ext}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    cb(ok ? null : new Error('Solo imágenes'), ok);
  }
});

// ── Config MDT Agent ──
const MDT_URL  = process.env.MDT_URL  || 'https://mdt-agente.up.railway.app';
const MDT_USER = process.env.MDT_USER || '';
const MDT_PASS = process.env.MDT_PASS || '';

// ── Helper: autenticar en MDT y obtener token ──
async function mdtToken() {
  if (!MDT_USER || !MDT_PASS) return null;
  try {
    const r = await fetch(`${MDT_URL}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: MDT_USER, password: MDT_PASS })
    });
    const d = await r.json();
    return d.token || null;
  } catch { return null; }
}

// ═══════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════

// ── POST /api/upload-banner ──
app.post('/api/upload-banner', upload.single('banner'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
  const url = `/banners/${req.file.filename}`;
  res.json({ ok: true, url });
});

// ── POST /api/send-email — proxy hacia MDT Agent ──
app.post('/api/send-email', async (req, res) => {
  const { to_email, to_name, subject, html } = req.body;
  if (!to_email || !html) return res.status(400).json({ error: 'Faltan to_email o html' });

  const token = await mdtToken();
  if (!token) return res.status(503).json({ error: 'MDT Agent no disponible o sin credenciales' });

  try {
    const r = await fetch(`${MDT_URL}/api/zepto-send`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
      body:    JSON.stringify({ to_email, to_name: to_name || to_email, subject, html })
    });
    const d = await r.json();
    res.json(d);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/send-bulk-email — envío masivo ──
app.post('/api/send-bulk-email', async (req, res) => {
  const { recipients, subject, html_template } = req.body;
  if (!Array.isArray(recipients) || !subject || !html_template) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  const token = await mdtToken();
  if (!token) return res.status(503).json({ error: 'MDT Agent no disponible' });

  const results = [];
  for (const r of recipients) {
    const personalizedHtml = html_template
      .replace(/\{\{nombres\}\}/g,   r.nombres   || '')
      .replace(/\{\{apellidos\}\}/g, r.apellidos || '')
      .replace(/\{\{email\}\}/g,     r.email     || '')
      .replace(/\{\{evento\}\}/g,    r.evento    || '');
    try {
      const resp = await fetch(`${MDT_URL}/api/zepto-send`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
        body:    JSON.stringify({ to_email: r.email, to_name: `${r.nombres} ${r.apellidos}`, subject, html: personalizedHtml })
      });
      const d = await resp.json();
      results.push({ email: r.email, ok: !d.error, detail: d });
    } catch (e) {
      results.push({ email: r.email, ok: false, detail: { error: e.message } });
    }
    // Pequeña pausa para no saturar el servidor
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  const ok  = results.filter(x => x.ok).length;
  const err = results.filter(x => !x.ok).length;
  res.json({ ok, err, results });
});

// ── Rutas de páginas ──
app.get('/',           (req, res) => res.sendFile(path.join(__dirname, 'hub.html')));
app.get('/registro',   (req, res) => res.sendFile(path.join(__dirname, 'registro.html')));
app.get('/admin',      (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ── Arranque ──
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Merlin Events v2 corriendo en puerto ${PORT}`));
