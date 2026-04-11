require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'esxai-crm-jwt-2026-cambiar';

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

// ─── Auth Middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
app.post('/auth/login', authLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
  const user = db.getCRMUser(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, display_name: user.display_name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { username: user.username, role: user.role, display_name: user.display_name } });
});

app.post('/auth/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  const user = db.getCRMUserById(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash))
    return res.status(401).json({ error: 'Contraseña actual incorrecta' });
  db.updateCRMPassword(req.user.id, bcrypt.hashSync(new_password, 10));
  res.json({ ok: true });
});

// ─── Team ─────────────────────────────────────────────────────────────────────
app.get('/api/team', requireAuth, (req, res) => res.json(db.getCRMUsers()));

app.post('/api/team', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const { username, password, display_name, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
  try {
    db.addCRMUser({ username, password_hash: bcrypt.hashSync(password, 10), display_name: display_name||username, role: role||'viewer' });
    res.json({ ok: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// ─── N8N Webhook ───────────────────────────────────────────────────────────────
app.post('/api/webhook/n8n', (req, res) => {
  const secret = db.getSetting('webhook_secret');
  const headerSecret = req.headers['x-webhook-secret'];
  if (secret && headerSecret && headerSecret !== secret)
    return res.status(401).json({ error: 'Secret inválido' });

  try {
    const body = req.body;
    const phone = body.phone || body.number || body.from;
    if (!phone) return res.status(400).json({ error: 'Falta phone' });

    const userData = body.user || body;
    const flow = (typeof userData.flow === 'string' ? JSON.parse(userData.flow) : userData.flow) || {};
    const session = flow.session || {};
    const registration = flow.registration || {};
    const navigation = flow.navigation || {};
    const learning = flow.learning || {};
    const diagnostic = flow.diagnostic || {};
    const modules = (learning.modules) || {};

    db.upsertUser({
      phone,
      name: registration.name || userData.name || body.contact_name || null,
      age_range: registration.age_range || userData.age || null,
      education_level: registration.education_level || userData.studies || null,
      accepted_privacy: session.accepted_privacy ? 1 : 0,
      message_count: session.message_count || 0,
      total_points: session.total_points || 0,
      current_stage: navigation.current_stage || null,
      current_step: navigation.current_step || null,
      m1_status:   modules.m1?.status   || 'locked',
      m1_progress: modules.m1?.progress || 0,
      m1_rating:   modules.m1?.rating   || null,
      m2_status:   modules.m2?.status   || 'locked',
      m2_progress: modules.m2?.progress || 0,
      m2_rating:   modules.m2?.rating   || null,
      m3_status:   modules.m3?.status   || 'locked',
      m3_progress: modules.m3?.progress || 0,
      m3_rating:   modules.m3?.rating   || null,
      diagnostic_status:  diagnostic.status  || 'not_started',
      diagnostic_profile: diagnostic.profile || null,
      last_interaction: session.last_interaction || new Date().toISOString(),
    });

    if (body.msg || body.message || body.user_message) {
      db.addInteraction({ user_phone:phone, direction:'in', message: body.msg||body.message||body.user_message, stage: navigation.current_stage, step: navigation.current_step, emotion: body.detected_emotion||null, points_earned:0 });
    }
    if (body.bot_response || body.response) {
      db.addInteraction({ user_phone:phone, direction:'out', message: body.bot_response||body.response, stage: navigation.current_stage, step: navigation.current_step, emotion:null, points_earned: body.points_earned||0 });
    }
    res.json({ ok: true, phone });
  } catch(err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Metrics ──────────────────────────────────────────────────────────────────
app.get('/api/metrics', requireAuth, (req, res) => res.json(db.getMetrics()));

// ─── Users ────────────────────────────────────────────────────────────────────
app.get('/api/users', requireAuth, (req, res) => res.json(db.getUsers(req.query)));

app.get('/api/users/:phone', requireAuth, (req, res) => {
  const user = db.getUser(req.params.phone);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ ...user, interactions: db.getUserInteractions(req.params.phone) });
});

app.patch('/api/users/:phone', requireAuth, (req, res) => {
  const allowed = ['lead_status','lead_notes','assigned_to'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Sin cambios' });
  db.updateUser(req.params.phone, updates);
  res.json({ ok: true });
});

app.delete('/api/users/:phone', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const deleted = db.deleteUser(req.params.phone);
  if (!deleted) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ ok: true });
});

app.post('/api/users/bulk-delete', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const { phones } = req.body;
  if (!phones || !Array.isArray(phones) || phones.length === 0)
    return res.status(400).json({ error: 'Falta array phones' });
  const deleted = db.deleteUsers(phones);
  res.json({ ok: true, deleted });
});

// ─── Pipeline ─────────────────────────────────────────────────────────────────
app.get('/api/pipeline', requireAuth, (req, res) => res.json(db.getPipeline()));

// ─── Settings ─────────────────────────────────────────────────────────────────
app.get('/api/settings', requireAuth, (req, res) => {
  const s = db.getSettings();
  res.json({
    launch_date: s.launch_date,
    crm_name: s.crm_name,
    webhook_url: `${req.protocol}://${req.get('host')}/api/webhook/n8n`,
    webhook_secret: s.webhook_secret,
  });
});

app.patch('/api/settings', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  ['launch_date','crm_name'].forEach(k => { if (req.body[k] !== undefined) db.setSetting(k, req.body[k]); });
  res.json({ ok: true });
});

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  ✅ EsXAI CRM corriendo en puerto ${PORT}   ║`);
  console.log(`╠══════════════════════════════════════════╣`);
  console.log(`║  🌐 http://localhost:${PORT}                ║`);
  console.log(`║  📡 Webhook: /api/webhook/n8n            ║`);
  console.log(`║  🔑 admin / esxai2026                    ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
});
