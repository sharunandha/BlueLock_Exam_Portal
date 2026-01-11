import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'database', 'exam.db');

const db = new sqlite3.Database(dbPath);

function allAsync(query) {
  return new Promise((resolve, reject) => db.all(query, (err, rows) => (err ? reject(err) : resolve(rows))));
}

(async () => {
  try {
    console.log('DB Path:', dbPath);
    const exams = await allAsync('SELECT * FROM exams');
    console.log('EXAMS:', exams);
    const subs = await allAsync('SELECT * FROM submissions');
    console.log('SUBMISSIONS:', subs.slice(0, 20));
  } catch (e) {
    console.error('DB read error:', e);
  } finally {
    db.close();
  }
})();