(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test API Exam', durationMinutes: 20, questions: [], active: true }),
    });
    console.log('status', res.status);
    console.log(await res.json());
  } catch (e) {
    console.error('error', e);
  }
})();