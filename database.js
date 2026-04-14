// ─── Base de datos JSON pura (sin SQLite, sin compilación nativa) ─────────────
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'esxai_crm.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── Estructura inicial de la DB ──────────────────────────────────────────────
const defaultDB = {
  users: {},           // { phone: userData }
  interactions: [],    // [ { id, user_phone, ... } ]
  crm_users: [],       // [ { id, username, ... } ]
  settings: {
    launch_date: new Date().toISOString().split('T')[0],
    crm_name: 'EsXAI CRM',
    webhook_secret: Math.random().toString(36).substring(2, 18),
  },
  _interaction_seq: 0,
  _user_seq: 0,
};

// ─── Carga / Guardado ─────────────────────────────────────────────────────────
function load() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch(e) { console.error('Error loading DB:', e.message); }
  return JSON.parse(JSON.stringify(defaultDB));
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

let _db = load();

// ─── Inicialización ───────────────────────────────────────────────────────────
// Admin por defecto
if (!_db.crm_users) _db.crm_users = [];
if (!_db.crm_users.find(u => u.username === 'admin')) {
  _db.crm_users.push({
    id: 1,
    username: 'admin',
    password_hash: bcrypt.hashSync('esxai2026', 10),
    display_name: 'Administrador',
    role: 'admin',
    created_at: new Date().toISOString(),
  });
}

// Demo data si está vacía
if (!_db.users) _db.users = {};
if (Object.keys(_db.users).length === 0) {
  const now = Date.now();
  const demoUsers = [
    { phone:'5491112345001', name:'Valentina López',   age_range:'25-30', education_level:'universitario', message_count:42, session_messages:8,  total_points:85,  current_stage:'m2', current_step:'s2', m0_status:'completed', m0_progress:100, m0_rating:'5', m1_status:'completed', m1_progress:100, m1_rating:'5', m2_status:'in_progress', m2_progress:40,  m3_status:'locked', m3_progress:0,  diagnostic_status:'not_started', lead_status:'activo',   last_interaction: new Date(now-2*3600000).toISOString() },
    { phone:'5491112345002', name:'Matías Rodríguez',  age_range:'30-40', education_level:'secundario',    message_count:18, session_messages:5,  total_points:30,  current_stage:'m1', current_step:'s3', m0_status:'completed', m0_progress:100, m0_rating:'4', m1_status:'in_progress', m1_progress:60,  m2_status:'locked', m2_progress:0,  m3_status:'locked', m3_progress:0,  diagnostic_status:'not_started', lead_status:'activo',   last_interaction: new Date(now-5*3600000).toISOString() },
    { phone:'5491112345003', name:'Camila Fernández',  age_range:'18-25', education_level:'universitario', message_count:5,  session_messages:5,  total_points:5,   current_stage:'m0', current_step:'intro', m0_status:'in_progress', m0_progress:30, m1_status:'locked', m1_progress:0, m2_status:'locked', m2_progress:0,  m3_status:'locked', m3_progress:0,  diagnostic_status:'not_started', lead_status:'nuevo',    last_interaction: new Date(now-1*3600000).toISOString() },
    { phone:'5491112345004', name:'Lucas Martínez',    age_range:'30-40', education_level:'universitario', message_count:87, session_messages:12, total_points:200, current_stage:'m3', current_step:'s2', m0_status:'completed', m0_progress:100, m0_rating:'5', m1_status:'completed', m1_progress:100, m1_rating:'4', m2_status:'completed', m2_progress:100, m2_rating:'5', m3_status:'in_progress', m3_progress:50, diagnostic_status:'completed', diagnostic_profile:'moderado', lead_status:'cliente',  last_interaction: new Date(now-30*60000).toISOString() },
    { phone:'5491112345005', name:'Sofía García',      age_range:'25-30', education_level:'terciario',     message_count:3,  session_messages:3,  total_points:0,   current_stage:'onboarding', current_step:null, m0_status:'locked', m0_progress:0, m1_status:'locked', m1_progress:0, m2_status:'locked', m2_progress:0, m3_status:'locked', m3_progress:0, diagnostic_status:'not_started', lead_status:'nuevo',    last_interaction: new Date(now-20*60000).toISOString() },
    { phone:'5491112345006', name:'Nicolás Torres',    age_range:'40-50', education_level:'universitario', message_count:65, session_messages:6,  total_points:175, current_stage:'m3', current_step:'closing', m0_status:'completed', m0_progress:100, m0_rating:'5', m1_status:'completed', m1_progress:100, m1_rating:'5', m2_status:'completed', m2_progress:100, m2_rating:'4', m3_status:'completed', m3_progress:100, m3_rating:'5', diagnostic_status:'completed', diagnostic_profile:'agresivo', lead_status:'cliente', last_interaction: new Date(now-2*86400000).toISOString() },
    { phone:'5491112345007', name:'Florencia Pérez',   age_range:'25-30', education_level:'universitario', message_count:22, session_messages:7,  total_points:45,  current_stage:'m1', current_step:'s5', m0_status:'completed', m0_progress:100, m0_rating:'4', m1_status:'in_progress', m1_progress:80,  m2_status:'locked', m2_progress:0,  m3_status:'locked', m3_progress:0,  diagnostic_status:'not_started', lead_status:'activo',   last_interaction: new Date(now-4*3600000).toISOString() },
    { phone:'5491112345008', name:'Diego Sánchez',     age_range:'30-40', education_level:'primario',      message_count:1,  session_messages:1,  total_points:0,   current_stage:null, current_step:null, m0_status:'locked', m0_progress:0, m1_status:'locked', m1_progress:0, m2_status:'locked', m2_progress:0, m3_status:'locked', m3_progress:0, diagnostic_status:'not_started', lead_status:'nuevo',    last_interaction: new Date(now-10*60000).toISOString() },
  ];
  demoUsers.forEach(u => {
    _db.users[u.phone] = {
      ...u,
      accepted_privacy: 1,
      m0_rating: u.m0_rating || null,
      m1_rating: u.m1_rating || null,
      m2_rating: u.m2_rating || null,
      m3_rating: u.m3_rating || null,
      diagnostic_profile: u.diagnostic_profile || null,
      lead_notes: null,
      assigned_to: null,
      source: 'whatsapp',
      first_seen: new Date(now - Math.random()*5*86400000).toISOString(),
    };
  });
}

if (!_db.interactions) _db.interactions = [];
if (!_db.settings) _db.settings = defaultDB.settings;
if (!_db._interaction_seq) _db._interaction_seq = 0;
save(_db);

// ─── API pública (imita interfaz SQLite síncrona) ─────────────────────────────
const db = {
  // --- Users ---
  getUsers(filters = {}) {
    let users = Object.values(_db.users);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      users = users.filter(u => (u.name||'').toLowerCase().includes(q) || (u.phone||'').includes(q));
    }
    if (filters.lead_status) users = users.filter(u => u.lead_status === filters.lead_status);
    if (filters.module === 'm0') users = users.filter(u => u.m0_status !== 'locked');
    if (filters.module === 'm1') users = users.filter(u => u.m1_status !== 'locked');
    if (filters.module === 'm2') users = users.filter(u => u.m2_status !== 'locked');
    if (filters.module === 'm3') users = users.filter(u => u.m3_status !== 'locked');

    const sortMap = { last_interaction:'last_interaction', first_seen:'first_seen', total_points:'total_points', message_count:'message_count', name:'name' };
    const sortKey = sortMap[filters.sort] || 'last_interaction';
    const dir = filters.order === 'asc' ? 1 : -1;
    users.sort((a,b) => {
      const av = a[sortKey]||'', bv = b[sortKey]||'';
      return av < bv ? -dir : av > bv ? dir : 0;
    });

    const page = parseInt(filters.page)||1;
    const limit = parseInt(filters.limit)||50;
    const total = users.length;
    const paged = users.slice((page-1)*limit, page*limit);
    return { users: paged, total, page, pages: Math.ceil(total/limit) };
  },

  getUser(phone) {
    return _db.users[phone] || null;
  },

  upsertUser(data) {
    const existing = _db.users[data.phone] || { first_seen: new Date().toISOString(), lead_status:'nuevo', lead_notes:null, assigned_to:null, source:'whatsapp' };
    _db.users[data.phone] = { ...existing, ...data };
    save(_db);
  },

  updateUser(phone, updates) {
    if (!_db.users[phone]) return;
    _db.users[phone] = { ..._db.users[phone], ...updates };
    save(_db);
  },

  // --- Interactions ---
  addInteraction(data) {
    _db._interaction_seq++;
    _db.interactions.push({ id: _db._interaction_seq, ...data, timestamp: data.timestamp || new Date().toISOString() });
    // Keep last 10000 interactions
    if (_db.interactions.length > 10000) _db.interactions = _db.interactions.slice(-10000);
    save(_db);
  },

  getUserInteractions(phone, limit=100) {
    return _db.interactions.filter(i => i.user_phone === phone).slice(-limit).reverse();
  },

  getRecentInteractions(limit=20) {
    const recent = [..._db.interactions].sort((a,b) => b.timestamp > a.timestamp ? 1 : -1).slice(0, limit);
    return recent.map(i => ({ ...i, name: (_db.users[i.user_phone]||{}).name || null }));
  },

  // --- CRM Users ---
  getCRMUser(username) { return _db.crm_users.find(u => u.username === username) || null; },
  getCRMUserById(id) { return _db.crm_users.find(u => u.id === id) || null; },
  getCRMUsers() { return _db.crm_users.map(u => ({ id:u.id, username:u.username, display_name:u.display_name, role:u.role, created_at:u.created_at })); },

  addCRMUser(data) {
    if (_db.crm_users.find(u => u.username === data.username)) throw new Error('Usuario ya existe');
    const id = Math.max(0, ..._db.crm_users.map(u=>u.id)) + 1;
    _db.crm_users.push({ id, ...data, created_at: new Date().toISOString() });
    save(_db);
    return id;
  },

  updateCRMPassword(id, hash) {
    const u = _db.crm_users.find(u => u.id === id);
    if (u) { u.password_hash = hash; save(_db); }
  },

  // --- Settings ---
  getSetting(key) { return _db.settings[key]; },
  getSettings() { return { ..._db.settings }; },
  setSetting(key, value) { _db.settings[key] = value; save(_db); },

  // --- Metrics ---
  getMetrics() {
    const users = Object.values(_db.users);
    const now = Date.now();
    const todayStr = new Date().toISOString().slice(0,10);
    const launchDate = _db.settings.launch_date || '2026-01-01';

    const total = users.length;
    const fromLaunch = users.filter(u => (u.first_seen||'') >= launchDate).length;
    const activeToday = users.filter(u => (u.last_interaction||'').slice(0,10) === todayStr).length;
    const activeWeek = users.filter(u => new Date(u.last_interaction||0) >= new Date(now - 7*86400000)).length;
    const clients = users.filter(u => u.lead_status === 'cliente').length;
    const msgsToday = _db.interactions.filter(i => (i.timestamp||'').slice(0,10) === todayStr).length;
    const avgPoints = users.filter(u=>u.total_points>0).reduce((s,u)=>s+u.total_points,0) / (users.filter(u=>u.total_points>0).length||1);

    // Pipeline
    const pipelineMap = {};
    users.forEach(u => { const s = u.lead_status||'nuevo'; pipelineMap[s] = (pipelineMap[s]||0)+1; });
    const pipeline = Object.entries(pipelineMap).map(([lead_status,c])=>({lead_status,c}));

    // Modules
    const m0Active = users.filter(u=>u.m0_status==='in_progress').length;
    const m0Done   = users.filter(u=>u.m0_status==='completed').length;
    const m1Active = users.filter(u=>u.m1_status==='in_progress').length;
    const m1Done   = users.filter(u=>u.m1_status==='completed').length;
    const m2Active = users.filter(u=>u.m2_status==='in_progress').length;
    const m2Done   = users.filter(u=>u.m2_status==='completed').length;
    const m3Active = users.filter(u=>u.m3_status==='in_progress').length;
    const m3Done   = users.filter(u=>u.m3_status==='completed').length;

    // Daily signups last 14 days
    const daily = {};
    for (let i=13; i>=0; i--) {
      const d = new Date(now - i*86400000).toISOString().slice(0,10);
      daily[d] = 0;
    }
    users.forEach(u => {
      const d = (u.first_seen||'').slice(0,10);
      if (daily[d] !== undefined) daily[d]++;
    });

    return {
      total, fromLaunch, activeToday, activeWeek, clients, msgsToday,
      avgPoints: Math.round(avgPoints),
      pipeline,
      modules: { m0Active, m0Done, m1Active, m1Done, m2Active, m2Done, m3Active, m3Done },
      daily: Object.entries(daily).map(([day,c])=>({day,c})),
      recent: db.getRecentInteractions(15),
      launchDate,
    };
  },

  getPipeline() {
    const stages = ['nuevo','activo','caliente','cliente','inactivo'];
    const result = {};
    stages.forEach(s => {
      result[s] = Object.values(_db.users)
        .filter(u => u.lead_status === s)
        .sort((a,b) => b.last_interaction > a.last_interaction ? 1 : -1);
    });
    return result;
  },
};

module.exports = db;
