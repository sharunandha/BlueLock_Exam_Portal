
import express from 'express';
import sqlite3 from 'sqlite3';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import { fileURLToPath } from 'url';

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  socket.on('disconnect', () => console.log('Socket disconnected:', socket.id));
});

app.use(express.json());

// Simple CORS and OPTIONS handling so dev frontend (different port) can call APIs directly
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve the built frontend if available (production). Otherwise, fall back to project root and warn
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  console.log('Serving built frontend from:', distDir);
  app.use(express.static(distDir));
  // SPA fallback for non-API GET requests (avoid router path parsing issues)
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && path.extname(req.path) === '') {
      return res.sendFile(path.join(distDir, 'index.html'));
    }
    next();
  });
} else {
  console.warn('\n\x1b[33mWarning: built frontend not found. For development run `npm run dev` (Vite) or create a build with `npm run build` before starting the server.\x1b[0m\n');
  app.use(express.static('.'));
} 

// Always expose generated reports via /reports
app.use('/reports', express.static(path.join(__dirname, 'reports')));


// Database Initialization
const defaultDbDir = path.join(__dirname, 'database');
const sqliteFile = process.env.SQLITE_FILE ? path.resolve(__dirname, process.env.SQLITE_FILE) : path.join(defaultDbDir, 'exam.db');
const sqliteDir = path.dirname(sqliteFile);
if (!fs.existsSync(sqliteDir)) fs.mkdirSync(sqliteDir, { recursive: true });

// Note: sqlite3 might require .verbose() or access through the default object depending on version
const db = new sqlite3.Database(sqliteFile);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY, 
    title TEXT, 
    duration INTEGER, 
    questions TEXT,
    active BOOLEAN
  )`);

  // ensure schedule columns exist (add if missing)
  db.all("PRAGMA table_info(exams)", (err, rows) => {
    if (!err && rows) {
      const names = rows.map((r) => r.name);
      if (!names.includes('startTime')) db.run('ALTER TABLE exams ADD COLUMN startTime INTEGER');
      if (!names.includes('endTime')) db.run('ALTER TABLE exams ADD COLUMN endTime INTEGER');
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    userName TEXT,
    examId TEXT,
    score INTEGER,
    totalMarks INTEGER,
    violations TEXT,
    startTime INTEGER,
    endTime INTEGER,
    browser TEXT
  )`);

  // Remove all duplicate submission rows (keep latest per userId+examId), then create unique index
  db.run(`DELETE FROM submissions WHERE id NOT IN (SELECT MAX(id) FROM submissions GROUP BY userId, examId)` , function (delErr) {
    if (delErr) console.error('Error cleaning duplicate submissions:', delErr);
    else console.log('Duplicate submissions cleanup performed, removed rows:', this.changes);

    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_submissions_user_exam ON submissions(userId, examId)`, (idxErr) => {
      if (idxErr) console.error('Could not create unique index:', idxErr);
    });
  });
});

// Report Directory (configurable via REPORT_DIR env var)
const reportDir = process.env.REPORT_DIR ? path.resolve(__dirname, process.env.REPORT_DIR) : path.join(__dirname, 'reports', 'BlueLock_Exam_Reports');
const reportsRoot = path.dirname(reportDir);
if (!fs.existsSync(reportsRoot)) fs.mkdirSync(reportsRoot, { recursive: true });
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

// API Endpoints

// Exams: list, create, update
app.get('/api/exams', (req, res) => {
  db.all('SELECT * FROM exams', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const parsed = rows.map((r) => ({
      id: r.id,
      title: r.title,
      durationMinutes: r.duration,
      questions: r.questions ? JSON.parse(r.questions) : [],
      active: !!r.active,
      startTime: r.startTime || null,
      endTime: r.endTime || null,
    }));
    res.json(parsed);
  });
});

app.post('/api/exams', (req, res) => {
  const { id = String(Date.now()), title, durationMinutes, questions = [], active = false, startTime = null, endTime = null } = req.body;
  const qstr = JSON.stringify(questions);
  const query = `INSERT INTO exams (id, title, duration, questions, active, startTime, endTime) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(query, [id, title, durationMinutes, qstr, active ? 1 : 0, startTime, endTime], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const exam = { id, title, durationMinutes, questions, active, startTime, endTime };
    io.emit('examCreated', exam);
    res.json({ success: true, exam });
  });
});

app.put('/api/exams/:id', (req, res) => {
  const id = req.params.id;
  const { title, durationMinutes, questions = [], active = false, startTime = null, endTime = null } = req.body;
  const qstr = JSON.stringify(questions);
  db.run(`UPDATE exams SET title = ?, duration = ?, questions = ?, active = ?, startTime = ?, endTime = ? WHERE id = ?`, [title, durationMinutes, qstr, active ? 1 : 0, startTime, endTime, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const exam = { id, title, durationMinutes, questions, active, startTime, endTime };
    io.emit('examUpdated', exam);
    res.json({ success: true, exam });
  });
});

// Questions: add, update, delete
app.post('/api/exams/:id/questions', (req, res) => {
  const id = req.params.id;
  const { type, text, options = [], correctAnswer } = req.body;

  db.get('SELECT * FROM exams WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Exam not found' });

    const questions = row.questions ? JSON.parse(row.questions) : [];
    if (questions.length >= 100) return res.status(400).json({ error: 'Maximum 100 questions allowed' });

    const qid = String(Date.now()) + '_' + Math.floor(Math.random() * 10000);
    const q = { id: qid, type, text, options, correctAnswer };
    questions.push(q);

    db.run('UPDATE exams SET questions = ? WHERE id = ?', [JSON.stringify(questions), id], function(uerr) {
      if (uerr) return res.status(500).json({ error: uerr.message });
      io.emit('examUpdated', { id, title: row.title, durationMinutes: row.duration, questions, active: !!row.active });
      res.json({ success: true, question: q });
    });
  });
});

app.put('/api/exams/:id/questions/:qid', (req, res) => {
  const id = req.params.id;
  const qid = req.params.qid;
  const { type, text, options = [], correctAnswer } = req.body;

  db.get('SELECT * FROM exams WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Exam not found' });

    const questions = row.questions ? JSON.parse(row.questions) : [];
    const idx = questions.findIndex(q => q.id === qid);
    if (idx === -1) return res.status(404).json({ error: 'Question not found' });

    questions[idx] = { id: qid, type, text, options, correctAnswer };

    db.run('UPDATE exams SET questions = ? WHERE id = ?', [JSON.stringify(questions), id], function(uerr) {
      if (uerr) return res.status(500).json({ error: uerr.message });
      io.emit('examUpdated', { id, title: row.title, durationMinutes: row.duration, questions, active: !!row.active });
      res.json({ success: true, question: questions[idx] });
    });
  });
});

app.delete('/api/exams/:id/questions/:qid', (req, res) => {
  const id = req.params.id;
  const qid = req.params.qid;
  db.get('SELECT * FROM exams WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Exam not found' });

    const questions = row.questions ? JSON.parse(row.questions) : [];
    const newQs = questions.filter(q => q.id !== qid);

    db.run('UPDATE exams SET questions = ? WHERE id = ?', [JSON.stringify(newQs), id], function(uerr) {
      if (uerr) return res.status(500).json({ error: uerr.message });
      io.emit('examUpdated', { id, title: row.title, durationMinutes: row.duration, questions: newQs, active: !!row.active });
      res.json({ success: true, id, qid });
    });
  });
});

// Delete exam
app.delete('/api/exams/:id', (req, res) => {
  const id = req.params.id;
  db.run(`DELETE FROM exams WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    io.emit('examDeleted', { id });
    res.json({ success: true, id });
  });
});

// Stats
app.get('/api/stats', (req, res) => {
  db.all('SELECT * FROM submissions', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const totalStudents = rows.length;
    let avgScore = 0;
    let passCount = 0;
    let totalViolations = 0;

    rows.forEach(r => {
      const total = r.totalMarks || 0;
      const score = r.score || 0;
      if (total > 0) {
        avgScore += (score / total) * 100;
        if ((score / total) >= 0.5) passCount += 1;
      }
      try { const vs = JSON.parse(r.violations || '[]'); totalViolations += vs.length; } catch(e) { void e; }
    });

    if (totalStudents > 0) avgScore = avgScore / totalStudents;
    res.json({ totalStudents, avgScore, passCount, totalViolations });
  });
});

// Export All Submissions as Excel
app.get('/api/export/all', async (req, res) => {
  db.all('SELECT * FROM submissions ORDER BY id DESC', async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Submissions');
      sheet.columns = [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'User ID', key: 'userId', width: 20 },
        { header: 'User Name', key: 'userName', width: 25 },
        { header: 'Exam ID', key: 'examId', width: 20 },
        { header: 'Score', key: 'score', width: 10 },
        { header: 'Total', key: 'totalMarks', width: 10 },
        { header: 'Percentage', key: 'percentage', width: 12 },
        { header: 'Violations', key: 'violations', width: 30 },
        { header: 'Start Time', key: 'startTime', width: 20 },
        { header: 'End Time', key: 'endTime', width: 20 },
        { header: 'Browser', key: 'browser', width: 20 }
      ];

      rows.forEach(r => {
        const total = r.totalMarks || 0;
        const perc = total > 0 ? ((r.score || 0) / total) * 100 : 0;
        sheet.addRow({
          id: r.id,
          userId: r.userId,
          userName: r.userName,
          examId: r.examId,
          score: r.score,
          totalMarks: total,
          percentage: `${perc.toFixed(2)}%`,
          violations: r.violations || '[]',
          startTime: r.startTime ? new Date(r.startTime).toLocaleString() : '',
          endTime: r.endTime ? new Date(r.endTime).toLocaleString() : '',
          browser: r.browser
        });
      });

      const fileName = `all_submissions_${Date.now()}.xlsx`;
      const filePath = path.join(reportDir, fileName);
      await workbook.xlsx.writeFile(filePath);
      res.json({ success: true, file: `/reports/BlueLock_Exam_Reports/${fileName}` });
    } catch(ex) {
      res.status(500).json({ error: ex.message });
    }
  });
});

// Submissions list
app.get('/api/submissions', (req, res) => {
  db.all('SELECT * FROM submissions ORDER BY id DESC LIMIT 100', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const parsed = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      examId: r.examId,
      score: r.score,
      totalMarks: r.totalMarks,
      violations: r.violations ? JSON.parse(r.violations) : [],
      startTime: r.startTime,
      endTime: r.endTime,
      browser: r.browser,
    }));
    res.json(parsed);
  });
});

// Check whether a user has already submitted an exam
app.get('/api/submissions/check', (req, res) => {
  const { examId, userId } = req.query;
  if (!examId || !userId) return res.status(400).json({ error: 'Missing examId or userId' });
  db.get('SELECT id FROM submissions WHERE examId = ? AND userId = ?', [examId, userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ submitted: !!row, submissionId: row ? row.id : null });
  });
});
app.post('/api/submit', async (req, res) => {
  const data = req.body;

  // Prevent multiple submissions by the same user for the same exam
  db.get('SELECT id FROM submissions WHERE userId = ? AND examId = ?', [data.userId, data.examId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) return res.status(400).json({ error: 'User has already submitted this exam' });

    const query = `INSERT INTO submissions 
      (userId, userName, examId, score, totalMarks, violations, startTime, endTime, browser) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      data.userId,
      data.userName,
      data.examId,
      data.score,
      data.totalQuestions,
      JSON.stringify(data.violations),
      data.startTime,
      data.endTime,
      'Chrome/Edge',
    ];

    db.run(query, params, async function (err) {
      if (err) {
        console.error('Database Error:', err);
        return res.status(500).json({ error: err.message });
      }

      (async () => {
        try {
          const workbook = new ExcelJS.Workbook();
          const sheet = workbook.addWorksheet('Result');
          sheet.columns = [
            { header: 'Field', key: 'field', width: 25 },
            { header: 'Value', key: 'value', width: 40 },
          ];

          sheet.addRows([
            { field: 'Student Name', value: data.userName },
            { field: 'Registration ID', value: data.userId },
            { field: 'Exam Name', value: data.examName || data.examId },
            { field: 'Score', value: `${data.score}/${data.totalQuestions}` },
            { field: 'Percentage', value: `${((data.score / data.totalQuestions) * 100).toFixed(2)}%` },
            { field: 'Violations Count', value: data.violations.length },
            { field: 'Start Time', value: new Date(data.startTime).toLocaleString() },
            { field: 'End Time', value: new Date(data.endTime).toLocaleString() },
            { field: 'Status', value: data.score / data.totalQuestions >= 0.5 ? 'PASS' : 'FAIL' },
          ]);

          sheet.getRow(1).font = { bold: true };

          const safeName = data.userName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const fileName = `${safeName}_${data.examId}_${Date.now()}.xlsx`;
          const filePath = path.join(reportDir, fileName);

          await workbook.xlsx.writeFile(filePath);
          console.log(`Excel Report generated: ${fileName}`);

          // Emit submission event for real-time monitoring
          io.emit('submission', {
            id: this.lastID,
            userId: data.userId,
            userName: data.userName,
            examId: data.examId,
            score: data.score,
            totalQuestions: data.totalQuestions,
            startTime: data.startTime,
            endTime: data.endTime,
            reportPath: fileName,
          });

          res.json({ success: true, submissionId: this.lastID, reportPath: fileName });
        } catch (excelErr) {
          console.error('Excel Generation Error:', excelErr);
          // still emit the submission event even if excel fails
          io.emit('submission', {
            id: this.lastID,
            userId: data.userId,
            userName: data.userName,
            examId: data.examId,
            score: data.score,
            totalQuestions: data.totalQuestions,
            startTime: data.startTime,
            endTime: data.endTime,
            reportPath: null,
          });
          res.json({ success: true, submissionId: this.lastID, warning: 'Data saved to DB, but Excel file generation failed.' });
        }
      })();
    });
  });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(port, '0.0.0.0', () => {
    console.log(`\x1b[34m%s\x1b[0m`, `==================================================`);
    console.log(`\x1b[1m\x1b[36m%s\x1b[0m`, `  BlueLock Exam Portal - System Online`);
    console.log(`\x1b[37m%s\x1b[0m`, `  URL: http://localhost:${port}`);
    console.log(`\x1b[37m%s\x1b[0m`, `  Reports: /reports/BlueLock_Exam_Reports/`);
    console.log(`\x1b[34m%s\x1b[0m`, `==================================================`);
  });
}

// For test environments, expose helpful handles on globalThis (not required in production)
if (process.env.NODE_ENV === 'test') {
  globalThis.__bluelock__ = { app, server, db, reportDir };
}
