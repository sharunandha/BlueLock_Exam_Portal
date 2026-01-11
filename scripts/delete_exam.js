(async () => {
  try {
    const exams = await (await fetch('http://localhost:3000/api/exams')).json();
    console.log('exams before delete', exams);
    for (const e of exams) {
      if (e.title === 'Test API Exam') {
        const r = await fetch('http://localhost:3000/api/exams/' + e.id, { method: 'DELETE' });
        console.log('deleted', e.id, 'status', r.status, await r.json());
      }
    }
    console.log('exams after', await (await fetch('http://localhost:3000/api/exams')).json());
  } catch (e) {
    console.error('err', e);
  }
})();