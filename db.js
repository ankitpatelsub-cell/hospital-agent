// db.js — SQLite layer for the Hospital: departments, doctors, appointments, queue tokens.
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'hospital.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_hi TEXT DEFAULT '',
  icon TEXT DEFAULT '🏥'
);
CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  dept_id INTEGER,
  qualification TEXT DEFAULT '',
  fee INTEGER DEFAULT 500
);
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient TEXT NOT NULL,
  phone TEXT NOT NULL,
  dept_id INTEGER,
  doctor_id INTEGER,
  slot TEXT DEFAULT '',
  token INTEGER DEFAULT 0,
  status TEXT DEFAULT 'booked',
  created TEXT DEFAULT (datetime('now'))
);
`);

const DB = {
  departments: () => db.prepare('SELECT * FROM departments ORDER BY id').all(),
  doctors: () => db.prepare(`SELECT d.*, dep.name AS dept FROM doctors d LEFT JOIN departments dep ON dep.id=d.dept_id ORDER BY d.id`).all(),
  doctorsByDept: (deptId) => db.prepare('SELECT * FROM doctors WHERE dept_id=? ORDER BY id').all(deptId),
  addDepartment: (d) => db.prepare('INSERT INTO departments (name,name_hi,icon) VALUES (?,?,?)').run(d.name, d.name_hi || '', d.icon || '🏥'),
  addDoctor: (d) => db.prepare('INSERT INTO doctors (name,dept_id,qualification,fee) VALUES (?,?,?,?)').run(d.name, d.dept_id, d.qualification || '', d.fee || 500),
  appointments: () => db.prepare(`SELECT a.*, dep.name AS dept, doc.name AS doctor FROM appointments a
      LEFT JOIN departments dep ON dep.id=a.dept_id LEFT JOIN doctors doc ON doc.id=a.doctor_id
      ORDER BY a.id DESC`).all(),
  book: (b) => {
    const todayCount = db.prepare(`SELECT COUNT(*) c FROM appointments WHERE date(created)=date('now')`).get().c;
    const token = todayCount + 1;
    const r = db.prepare('INSERT INTO appointments (patient,phone,dept_id,doctor_id,slot,token) VALUES (?,?,?,?,?,?)')
      .run(b.patient, b.phone, b.dept_id || null, b.doctor_id || null, b.slot || '', token);
    return { id: r.lastInsertRowid, token };
  },
  setStatus: (id, status) => db.prepare('UPDATE appointments SET status=? WHERE id=?').run(status, id),
  waitingCount: () => db.prepare(`SELECT COUNT(*) c FROM appointments WHERE status='booked' AND date(created)=date('now')`).get().c,
  stats: () => ({
    departments: db.prepare('SELECT COUNT(*) c FROM departments').get().c,
    doctors: db.prepare('SELECT COUNT(*) c FROM doctors').get().c,
    today: db.prepare(`SELECT COUNT(*) c FROM appointments WHERE date(created)=date('now')`).get().c,
    waiting: db.prepare(`SELECT COUNT(*) c FROM appointments WHERE status='booked' AND date(created)=date('now')`).get().c,
  }),
};

// Seed once
if (DB.departments().length === 0) {
  const deps = [
    ['General Medicine', 'सामान्य चिकित्सा', '🩺'], ['Cardiology', 'हृदय रोग', '❤️'],
    ['Orthopedics', 'हड्डी रोग', '🦴'], ['Pediatrics', 'बाल रोग', '👶'],
    ['Gynecology', 'स्त्री रोग', '🤰'], ['ENT', 'कान-नाक-गला', '👂'],
  ];
  deps.forEach(d => DB.addDepartment({ name: d[0], name_hi: d[1], icon: d[2] }));
  const docs = [
    ['Dr. Sharma', 1, 'MBBS, MD', 400], ['Dr. Patel', 2, 'MBBS, DM Cardiology', 800],
    ['Dr. Rao', 3, 'MS Ortho', 600], ['Dr. Mehta', 4, 'MBBS, DCH', 500],
    ['Dr. Desai', 5, 'MBBS, MS Gynec', 700], ['Dr. Iyer', 6, 'MBBS, MS ENT', 550],
  ];
  docs.forEach(d => DB.addDoctor({ name: d[0], dept_id: d[1], qualification: d[2], fee: d[3] }));
  console.log('[hospital db] seeded 6 departments + 6 doctors');
}

module.exports = DB;
