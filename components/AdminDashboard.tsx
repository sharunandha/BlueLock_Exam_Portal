import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Exam } from '../types';

interface Props {
  exams: Exam[];
  setExams: React.Dispatch<React.SetStateAction<Exam[]>>;
}

const AdminDashboard: React.FC<Props> = ({ exams, setExams }) => {
  const [activeTab, setActiveTab] = useState<'EXAMS' | 'REPORTS' | 'ANALYTICS'>('EXAMS');
  const [liveSubmissions, setLiveSubmissions] = useState<any[]>([]);
  const [expandedExam, setExpandedExam] = useState<string | null>(null);

  // Simulated Analytics (will be updated with real data shortly)
  const [stats, setStats] = useState({
    totalStudents: 142,
    avgScore: 78.4,
    passRate: 85,
    totalViolations: 12,
  });

  // Local helpers to update UI state proactively (won't duplicate socket-updates)
  const replaceExamLocal = (exam: Exam) => setExams((prev) => prev.map((e) => (e.id === exam.id ? { ...e, ...exam } : e)));
  const removeExamLocal = (id: string) => setExams((prev) => prev.filter((e) => e.id !== id));


  useEffect(() => {
    // Fetch real exams from server
    (async () => {
      try {
        const r = await fetch('/api/exams');
        if (!r.ok) throw new Error('Failed to fetch exams');
        const data = await r.json();
        setExams(data);
      } catch (e) {
        console.error('Exams fetch error:', e);
        alert('Could not fetch exams from server — is the backend running?');
      }

      try {
        const s = await (await fetch('/api/stats')).json();
        setStats(s);
      } catch (e) {
        console.error('Stats fetch error:', e);
        // keep existing values but notify briefly
        // alert('Could not fetch stats from server');
      }
    })();



    // Connect socket explicitly to current origin so Vite proxy can forward /socket.io in dev
    let socket;
    try {
      socket = io(window.location.origin);
    } catch (err) {
      console.error('Socket.IO init error:', err);
      // provide a no-op socket so the component doesn't crash in environments without window/socket
      socket = {
        on: () => {},
        disconnect: () => {},
      } as any;
    }

    socket.on('submission', (s: any) => {
      try {
        setLiveSubmissions((prev) => [s, ...prev].slice(0, 20));
        // refresh stats from server for accuracy
        fetch('/api/stats')
          .then((r) => r.json())
          .then((ns) => setStats(ns))
          .catch(() => {});
      } catch (e) {
        console.error('Error processing submission event', e);
      }
    });

    socket.on('examCreated', (exam: Exam) => {
      // only add if not present (avoid duplicate when client also adds on response)
      setExams((prev) => (prev.some((e) => e.id === exam.id) ? prev : [exam, ...prev]));
    });

    socket.on('examUpdated', (exam: Exam) => {
      setExams((prev) => (prev.some((e) => e.id === exam.id) ? prev.map((e) => (e.id === exam.id ? { ...e, ...exam } : e)) : [exam, ...prev]));
    });

    socket.on('examDeleted', ({ id }: any) => {
      setExams((prev) => prev.filter((e) => e.id !== id));
    });

    return () => {
      socket.disconnect();
    };
  }, [setExams]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold">Admin Command Center</h2>
          <p className="text-slate-400">Manage exams, view security logs, and generate reports.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                const title = prompt('Exam title');
                if (!title) return;
                const duration = parseInt(prompt('Duration minutes', '30') || '30', 10);
                const active = confirm('Set exam active? OK = active');

                // Ask for schedule in 12-hour format. Support full date/time or just time (today)
                const parse12 = (input: string | null) => {
                  if (!input) return null;
                  // If user enters full date e.g., 2026-01-11 08:00 AM or 2026-01-11 8:00 PM
                  let s = input.trim();
                  // replace multiple spaces
                  s = s.replace(/\s+/g, ' ');
                  // Accept either 'hh:mm AM' or 'YYYY-MM-DD hh:mm AM'
                  if (!/\d{4}-\d{2}-\d{2}/.test(s)) {
                    // assume today
                    const today = new Date();
                    const datePart = today.toISOString().slice(0, 10);
                    s = `${datePart} ${s}`;
                  }
                  const t = new Date(s);
                  if (isNaN(t.getTime())) return null;
                  return t.getTime();
                };

                const startInput = prompt('Start time (e.g. "08:00 AM" or "2026-01-11 08:00 AM")');
                const endInput = prompt('End time (e.g. "08:00 PM" or "2026-01-11 08:00 PM")');
                const startTime = parse12(startInput);
                const endTime = parse12(endInput);

                const newExam: any = { title, durationMinutes: duration, questions: [], active };
                if (startTime) newExam.startTime = startTime;
                if (endTime) newExam.endTime = endTime;

                const r = await fetch('/api/exams', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(newExam),
                });
                if (!r.ok) {
                  const errText = await r.text();
                  throw new Error('Create failed: ' + errText);
                }
                const j = await r.json();
                if (j?.exam) {
                  // avoid duplication if already exists
                  setExams((prev) => (prev.some((e) => e.id === j.exam.id) ? prev : [j.exam, ...prev]));
                  alert('Created exam: ' + j.exam.title);
                }
              } catch (e) {
                console.error('Create exam error', e);
                alert('Could not create exam — check server logs or network.');
              }
            }}
            className="bg-sky-600 hover:bg-sky-500 px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-plus"></i> New Exam
          </button>
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/export/all');
                if (!res.ok) throw new Error(await res.text());
                const j = await res.json();
                if (j?.file) {
                  window.open(j.file, '_blank');
                }
              } catch (e) {
                console.error('Export failed', e);
                alert('Export failed: ' + String(e));
              }
            }}
            className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-file-excel"></i> Export All
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            label: 'Students Attended',
            val: stats.totalStudents,
            icon: 'fa-users',
            color: 'text-sky-400',
          },
          {
            label: 'Avg. Score',
            val: stats.avgScore + '%',
            icon: 'fa-chart-line',
            color: 'text-green-400',
          },
          {
            label: 'Pass Rate',
            val: stats.passRate + '%',
            icon: 'fa-award',
            color: 'text-purple-400',
          },
          {
            label: 'Security Violations',
            val: stats.totalViolations,
            icon: 'fa-triangle-exclamation',
            color: 'text-red-400',
          },
        ].map((s, i) => (
          <div key={i} className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
            <div className="flex justify-between items-start mb-4">
              <span className="text-slate-400 text-sm font-medium">{s.label}</span>
              <i className={`fa-solid ${s.icon} ${s.color}`}></i>
            </div>
            <div className="text-2xl font-bold">{s.val}</div>
          </div>
        ))}
      </div>

      {/* Live Feed */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <h3 className="font-bold text-lg mb-4">Recent Activity</h3>
          {!liveSubmissions.length && <p className="text-slate-500">No recent submissions yet.</p>}
          <ul className="space-y-3">
            {liveSubmissions.map((s, i) => (
              <li key={i} className="bg-slate-900/30 p-3 rounded flex justify-between items-center">
                <div>
                  <div className="font-medium">
                    {s.userName} <span className="text-slate-500">({s.userId})</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Exam: {s.examId} • Score: {s.score}/{s.totalQuestions}
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  {s?.endTime ? new Date(s.endTime).toLocaleTimeString() : ''}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <h3 className="font-bold text-lg mb-4">Live Controls</h3>
          <p className="text-slate-500 text-sm mb-4">
            Create or update exams and watch real-time updates.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={async () => {
                try {
                  const duration = 20;
                  const now = Date.now();
                  const newExam = {
                    title: 'Live Generated Test',
                    durationMinutes: duration,
                    questions: [],
                    active: true,
                    startTime: now,
                    endTime: now + duration * 60 * 1000,
                  };
                  const r = await fetch('/api/exams', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newExam),
                  });
                  if (!r.ok) {
                    throw new Error('Create failed');
                  }
                  const j = await r.json();
                  if (j?.exam) {
                    setExams((prev) => (prev.some((e) => e.id === j.exam.id) ? prev : [j.exam, ...prev]));
                    alert('Created exam: ' + j.exam.title);
                  }
                } catch (e) {
                  console.error('Create live exam error', e);
                  alert('Could not create live exam — check server or network');
                }
              }}
              className="bg-sky-600 hover:bg-sky-500 px-4 py-2 rounded-lg font-bold transition-all"
            >
              Create Live Exam
            </button>

            <button
              onClick={async () => {
                if (!exams[0]) return alert('No exams to toggle');
                const first = exams[0];
                const u = { ...first, active: !first.active };
                try {
                  const r = await fetch('/api/exams/' + first.id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(u),
                  });
                  if (!r.ok) throw new Error(await r.text());
                  const j = await r.json();
                  if (j?.exam) replaceExamLocal(j.exam);
                  else replaceExamLocal(u);
                  alert('Toggled first exam active state');
                } catch (e) {
                  console.error('Toggle failed', e);
                  alert('Toggle failed: ' + String(e));
                }
              }}
              className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold transition-all"
            >
              Toggle First Exam
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 gap-8">
        {['EXAMS', 'REPORTS', 'ANALYTICS'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`pb-4 px-2 font-bold transition-all relative ${
              activeTab === tab ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-sky-400 rounded-t-full"></div>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
        {activeTab === 'EXAMS' && (
          <table className="w-full text-left">
            <thead className="bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="p-4 font-bold text-sm text-slate-400">Exam Title</th>
                <th className="p-4 font-bold text-sm text-slate-400">Duration</th>
                <th className="p-4 font-bold text-sm text-slate-400">Questions</th>
                <th className="p-4 font-bold text-sm text-slate-400">Status</th>
                <th className="p-4 font-bold text-sm text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {exams.map((exam) => (
                <React.Fragment key={exam.id}>
                  <tr className="hover:bg-slate-700/30 transition-colors">
                    <td className="p-4 font-medium">{exam.title}</td>
                    <td className="p-4 text-slate-400">{exam.durationMinutes} mins</td>
                    <td className="p-4 text-slate-400">{(exam.questions || []).length} items</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          exam.active
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {exam.active ? 'Active' : 'Draft'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            const newTitle = prompt('Edit exam title', exam.title);
                            if (!newTitle) return;
                            const newDuration = parseInt(
                              prompt('Duration minutes', String(exam.durationMinutes)) ||
                                String(exam.durationMinutes),
                              10
                            );
                            const active = confirm('Set active? OK = active');
                            const parse12 = (input: string | null) => {
                              if (!input) return null;
                              let s = input.trim();
                              s = s.replace(/\s+/g, ' ');
                              if (!/\d{4}-\d{2}-\d{2}/.test(s)) {
                                const today = new Date();
                                const datePart = today.toISOString().slice(0, 10);
                                s = `${datePart} ${s}`;
                              }
                              const t = new Date(s);
                              if (isNaN(t.getTime())) return null;
                              return t.getTime();
                            };

                            const startInput = prompt('Start time (e.g. "08:00 AM" or "2026-01-11 08:00 AM")', exam.startTime ? new Date(exam.startTime).toLocaleString() : '');
                            const endInput = prompt('End time (e.g. "08:00 PM" or "2026-01-11 08:00 PM")', exam.endTime ? new Date(exam.endTime).toLocaleString() : '');
                            const startTime = parse12(startInput);
                            const endTime = parse12(endInput);

                            const payload: any = {
                              title: newTitle,
                              durationMinutes: newDuration,
                              questions: exam.questions,
                              active,
                              startTime: startTime || exam.startTime || null,
                              endTime: endTime || exam.endTime || null,
                            };
                            const r = await fetch('/api/exams/' + exam.id, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload),
                            });
                            if (!r.ok) throw new Error(await r.text());
                            const j = await r.json();
                            if (j?.exam) {
                              replaceExamLocal(j.exam);
                              alert('Updated exam');
                            }
                          }}
                          className="p-2 hover:bg-sky-500/20 hover:text-sky-400 rounded transition-all"
                        >
                          <i className="fa-solid fa-pen"></i>
                        </button>

                        <button
                          onClick={async () => {
                            if (!confirm('Delete this exam?')) return;
                            const r = await fetch('/api/exams/' + exam.id, { method: 'DELETE' });
                            const j = await r.json();
                            if (j?.success) {
                              removeExamLocal(exam.id);
                              alert('Deleted');
                            }
                          }}
                          className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>

                        <button
                          onClick={() => setExpandedExam(expandedExam === exam.id ? null : exam.id)}
                          className="p-2 hover:bg-slate-700/20 rounded transition-all text-sm"
                        >
                          Manage
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expandedExam === exam.id && (
                    <tr className="bg-slate-900/20">
                      <td colSpan={5} className="p-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h4 className="font-bold">
                              Questions ({(exam.questions || []).length})
                            </h4>
                            <ul className="mt-3 space-y-2">
                              {(exam.questions || []).map((q: any) => (
                                <li
                                  key={q.id}
                                  className="p-3 bg-slate-800 rounded flex justify-between items-center"
                                >
                                  <div>
                                    <div className="font-medium">
                                      [{q.type}] {q.text}
                                    </div>
                                    {q.options && q.options.length > 0 && (
                                      <div className="text-xs text-slate-400">
                                        Options: {q.options.join(' | ')}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={async () => {
                                        // edit question
                                        const type = prompt('Type (MCQ/MSQ/FIB)', q.type) || q.type;
                                        const text = prompt('Question text', q.text) || q.text;
                                        let options = q.options || [];
                                        let correctAnswer = q.correctAnswer;

                                        if (type === 'MCQ' || type === 'MSQ') {
                                          const opts = prompt(
                                            'Options (comma separated)',
                                            (options || []).join(',')
                                          );
                                          options = opts
                                            ? opts.split(',').map((s: string) => s.trim())
                                            : [];
                                          if (type === 'MCQ') {
                                            const idx =
                                              parseInt(
                                                prompt(
                                                  'Correct option number (1-based)',
                                                  String((q.correctAnswer as number) + 1)
                                                ) || '1',
                                                10
                                              ) - 1;
                                            correctAnswer = idx;
                                          } else {
                                            const idxs =
                                              prompt(
                                                'Correct option numbers (comma separated 1-based)',
                                                Array.isArray(q.correctAnswer)
                                                  ? (q.correctAnswer as number[])
                                                      .map((n) => n + 1)
                                                      .join(',')
                                                  : ''
                                              ) || '';
                                            correctAnswer = idxs
                                              ? idxs
                                                  .split(',')
                                                  .map((s: string) => parseInt(s.trim(), 10) - 1)
                                              : [];
                                          }
                                        } else {
                                          correctAnswer =
                                            prompt('Answer text', String(q.correctAnswer || '')) ||
                                            '';
                                        }

                                        const payload = { type, text, options, correctAnswer };
                                        const r = await fetch(
                                          '/api/exams/' + exam.id + '/questions/' + q.id,
                                          {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(payload),
                                          }
                                        );
                                        if (!r.ok) throw new Error(await r.text());
                                        const j = await r.json();
                                        if (j?.question) {
                                          const cur = exam.questions || [];
                                          const idx = cur.findIndex((x: any) => x.id === q.id);
                                          if (idx !== -1) {
                                            cur[idx] = j.question;
                                            replaceExamLocal({ ...exam, questions: cur });
                                          }
                                          alert('Question updated');
                                        }
                                      }}
                                      className="p-2 hover:bg-sky-500/20 hover:text-sky-400 rounded transition-all"
                                    >
                                      <i className="fa-solid fa-pen"></i>
                                    </button>

                                    <button
                                      onClick={async () => {
                                        if (!confirm('Delete this question?')) return;
                                        const r = await fetch(
                                          '/api/exams/' + exam.id + '/questions/' + q.id,
                                          { method: 'DELETE' }
                                        );
                                        const j = await r.json();
                                        if (j?.success) {
                                          const cur = (exam.questions || []).filter((x: any) => x.id !== q.id);
                                          replaceExamLocal({ ...exam, questions: cur });
                                          alert('Deleted question');
                                        }
                                      }}
                                      className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
                                    >
                                      <i className="fa-solid fa-trash"></i>
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="w-64">
                            <button
                              onClick={async () => {
                                const cur = exam.questions || [];
                                if (cur.length >= 100)
                                  return alert('Cannot add more than 100 questions');
                                const type = (
                                  prompt('Type (MCQ/MSQ/FIB)', 'MCQ') || 'MCQ'
                                ).toUpperCase();
                                const text = prompt('Question text') || '';
                                if (!text) return alert('Question text required');
                                let options: string[] = [];
                                let correctAnswer: any = null;

                                if (type === 'MCQ') {
                                  const opts = prompt('Options (comma separated)') || '';
                                  options = opts
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                  if (options.length < 2)
                                    return alert('MCQ needs at least 2 options');
                                  const idx =
                                    parseInt(
                                      prompt('Correct option number (1-based)', '1') || '1',
                                      10
                                    ) - 1;
                                  if (idx < 0 || idx >= options.length)
                                    return alert('Invalid correct option index');
                                  correctAnswer = idx;
                                } else if (type === 'MSQ') {
                                  const opts = prompt('Options (comma separated)') || '';
                                  options = opts
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                  if (options.length < 2)
                                    return alert('MSQ needs at least 2 options');
                                  const idxs =
                                    prompt(
                                      'Correct option numbers (comma separated 1-based)',
                                      ''
                                    ) || '';
                                  const arr = idxs
                                    .split(',')
                                    .map((s) => parseInt(s.trim(), 10) - 1)
                                    .filter((n: number) => !isNaN(n));
                                  if (!arr.length) return alert('Need at least one correct option');
                                  correctAnswer = arr;
                                } else if (type === 'FIB') {
                                  correctAnswer = prompt('Answer text', '') || '';
                                  if (!correctAnswer) return alert('Answer required');
                                } else {
                                  return alert('Unknown type');
                                }

                                const payload = { type, text, options, correctAnswer };
                                const r = await fetch('/api/exams/' + exam.id + '/questions', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(payload),
                                });
                                if (!r.ok) throw new Error(await r.text());
                                const j = await r.json();
                                if (j?.question) {
                                  // update local copy
                                  const cur = exam.questions || [];
                                  const newQs = [...cur, j.question];
                                  replaceExamLocal({ ...exam, questions: newQs });
                                  alert('Question added');
                                }
                              }}
                              className="w-full bg-sky-600 hover:bg-sky-500 text-white py-2 rounded font-bold"
                            >
                              Add Question
                            </button>
                            <p className="text-xs text-slate-400 mt-2">
                              Types supported: MCQ (single correct), MSQ (multiple correct), FIB
                              (text answer). Max 100 questions per exam.
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'REPORTS' && (
          <div className="p-8 text-center py-20">
            <i className="fa-solid fa-file-invoice text-4xl text-slate-600 mb-4"></i>
            <p className="text-slate-500">
              Individual student reports can be generated here as Excel files.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/export/all');
                    if (!res.ok) throw new Error(await res.text());
                    const j = await res.json();
                    if (j?.file) window.open(j.file, '_blank');
                  } catch (e) {
                    console.error('Export failed', e);
                    alert('Export failed: ' + String(e));
                  }
                }}
                className="bg-sky-600 py-2 px-6 rounded-lg"
              >
                Download Latest Batch
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
