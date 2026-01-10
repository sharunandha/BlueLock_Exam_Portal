import { describe, test, expect, afterAll, beforeAll } from 'vitest';

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

let serverProc: ChildProcessWithoutNullStreams | null = null;
let createdId: string | null = null;

const waitForServer = async (timeout = 5000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch('http://localhost:3000/api/exams');
      if (res.ok) return;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server did not start in time');
};

beforeAll(async () => {
  // start server as a subprocess so it binds to a port
  serverProc = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'development' },
  });

  serverProc.stdout?.on('data', () => {
    // optionally log
  });
  serverProc.stderr?.on('data', () => {
    // optionally log
  });

  await waitForServer();
});

afterAll(async () => {
  if (createdId) {
    // try to delete created exam via HTTP
    await fetch(`http://localhost:3000/api/exams/${createdId}`, { method: 'DELETE' });
  }
  if (serverProc) {
    serverProc.kill();
  }
});

describe('API Endpoints', () => {
  test('GET /api/exams returns array', async () => {
    const res = await fetch('http://localhost:3000/api/exams');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('POST /api/exams creates exam', async () => {
    const res = await fetch('http://localhost:3000/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Exam', durationMinutes: 10, questions: [] }),
    });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.exam).toBeTruthy();
    createdId = j.exam.id;
  });

  test('POST /api/exams/:id/questions adds question', async () => {
    if (!createdId) return;
    const res = await fetch(`http://localhost:3000/api/exams/${createdId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'MCQ', text: 'Q?', options: ['A', 'B'], correctAnswer: 0 }),
    });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.question).toHaveProperty('id');
  });
});
