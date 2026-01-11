(async () => {
  try {
    const payload = {
      userId: 'testuser',
      userName: 'Test User',
      examId: 'fake-exam-id',
      score: 3,
      totalQuestions: 5,
      violations: [],
      startTime: Date.now() - 1000 * 60 * 20,
      endTime: Date.now(),
      browser: 'NodeTest/1.0',
    };
    const r = await fetch('http://localhost:3000/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log('status', r.status, await r.json());
  } catch (e) {
    console.error(e);
  }
})();