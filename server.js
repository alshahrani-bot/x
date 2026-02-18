const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function initDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const seed = {
      customers: [],
      workers: [
        { id: 1, name: 'منى', specialty: 'تنظيف منزلي', hourlyRate: 45, available: true },
        { id: 2, name: 'سارة', specialty: 'رعاية أطفال', hourlyRate: 55, available: true },
        { id: 3, name: 'أمل', specialty: 'مساعدة مطبخ', hourlyRate: 40, available: true }
      ],
      bookings: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf8');
  }
}

function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8'); }
function hashPassword(p) { return crypto.createHash('sha256').update(p).digest('hex'); }

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid-json')); }
    });
    req.on('error', reject);
  });
}

function getAuthCustomer(req, db) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  return db.customers.find((c) => c.token === token) || null;
}

function serveStatic(reqPath, res) {
  const safePath = reqPath === '/' ? '/client.html' : reqPath;
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) return false;

  const ext = path.extname(filePath);
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain; charset=utf-8' });
  res.end(fs.readFileSync(filePath));
  return true;
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsed.pathname;

  try {
    if (req.method === 'POST' && pathname === '/api/auth/register') {
      const { name, phone, password } = await getBody(req);
      if (!name || !phone || !password) return sendJSON(res, 400, { message: 'جميع الحقول مطلوبة' });
      const db = readDB();
      if (db.customers.find((c) => c.phone === phone)) return sendJSON(res, 409, { message: 'رقم الجوال مسجل مسبقاً' });
      const customer = { id: db.customers.length + 1, name, phone, passwordHash: hashPassword(password), token: crypto.randomBytes(16).toString('hex') };
      db.customers.push(customer);
      writeDB(db);
      return sendJSON(res, 200, { token: customer.token, customer: { id: customer.id, name, phone } });
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const { phone, password } = await getBody(req);
      const db = readDB();
      const customer = db.customers.find((c) => c.phone === phone);
      if (!customer || customer.passwordHash !== hashPassword(password)) return sendJSON(res, 401, { message: 'بيانات الدخول غير صحيحة' });
      customer.token = crypto.randomBytes(16).toString('hex');
      writeDB(db);
      return sendJSON(res, 200, { token: customer.token, customer: { id: customer.id, name: customer.name, phone: customer.phone } });
    }

    if (req.method === 'GET' && pathname === '/api/workers') {
      return sendJSON(res, 200, readDB().workers);
    }

    if (req.method === 'POST' && pathname === '/api/bookings') {
      const db = readDB();
      const customer = getAuthCustomer(req, db);
      if (!customer) return sendJSON(res, 401, { message: 'يرجى تسجيل الدخول' });
      const { workerId, date, startHour, hours, notes } = await getBody(req);
      if (!workerId || !date || !startHour || !hours) return sendJSON(res, 400, { message: 'يرجى تعبئة بيانات الحجز' });
      const worker = db.workers.find((w) => w.id === Number(workerId));
      if (!worker) return sendJSON(res, 404, { message: 'العاملة غير موجودة' });
      const booking = { id: db.bookings.length + 1, customerId: customer.id, customerName: customer.name, workerId: worker.id, workerName: worker.name, date, startHour, hours: Number(hours), notes: notes || '', status: 'بانتظار التأكيد' };
      db.bookings.push(booking);
      writeDB(db);
      return sendJSON(res, 201, booking);
    }

    if (req.method === 'GET' && pathname === '/api/my-bookings') {
      const db = readDB();
      const customer = getAuthCustomer(req, db);
      if (!customer) return sendJSON(res, 401, { message: 'يرجى تسجيل الدخول' });
      return sendJSON(res, 200, db.bookings.filter((b) => b.customerId === customer.id));
    }

    if (req.method === 'GET' && pathname === '/api/office/overview') {
      const db = readDB();
      return sendJSON(res, 200, { customersCount: db.customers.length, workersCount: db.workers.length, bookingsCount: db.bookings.length, customers: db.customers.map(c => ({ id: c.id, name: c.name, phone: c.phone })), bookings: db.bookings });
    }

    if (req.method === 'PATCH' && pathname.startsWith('/api/office/bookings/')) {
      const id = Number(pathname.split('/').pop());
      const { status } = await getBody(req);
      const allowed = ['بانتظار التأكيد', 'مؤكد', 'مكتمل', 'ملغي'];
      if (!allowed.includes(status)) return sendJSON(res, 400, { message: 'حالة غير صحيحة' });
      const db = readDB();
      const booking = db.bookings.find((b) => b.id === id);
      if (!booking) return sendJSON(res, 404, { message: 'الحجز غير موجود' });
      booking.status = status;
      writeDB(db);
      return sendJSON(res, 200, booking);
    }

    if (pathname === '/client') return serveStatic('/client.html', res) || sendJSON(res, 404, { message: 'Not found' });
    if (pathname === '/office') return serveStatic('/admin.html', res) || sendJSON(res, 404, { message: 'Not found' });
    if (pathname === '/admin') return serveStatic('/admin.html', res) || sendJSON(res, 404, { message: 'Not found' });

    if (serveStatic(pathname, res)) return;

    sendJSON(res, 404, { message: 'Not found' });
  } catch (err) {
    if (err.message === 'invalid-json') return sendJSON(res, 400, { message: 'JSON غير صحيح' });
    sendJSON(res, 500, { message: 'خطأ في الخادم' });
  }
});

initDB();
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
