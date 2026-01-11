import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'database', 'exam.db');
const backupPath = dbPath + '.bak.' + Date.now();

try {
  fs.copyFileSync(dbPath, backupPath);
  console.log('Backup created at', backupPath);
} catch (e) {
  console.error('Backup failed', e);
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run('DELETE FROM exams', function (err) {
    if (err) return console.error('Error deleting exams:', err);
    console.log('Deleted exams rows:', this.changes);
  });

  db.run('DELETE FROM submissions', function (err) {
    if (err) return console.error('Error deleting submissions:', err);
    console.log('Deleted submissions rows:', this.changes);
  });

  db.run('VACUUM', (err) => {
    if (err) console.error('Vacuum failed', err);
    else console.log('Database vacuumed');
    db.close();
  });
});