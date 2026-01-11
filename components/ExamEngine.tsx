import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Exam, User, Violation } from '../types';

interface Props {
  exam: Exam;
  user: User;
  onFinish: () => void;
}

const VIOLATION_LIMIT = 3;

const ExamEngine: React.FC<Props> = ({ exam, user, onFinish }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [violations, setViolations] = useState<Violation[]>([]);
  const [timeLeft, setTimeLeft] = useState(exam.durationMinutes * 60);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showViolationLog, setShowViolationLog] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  const enterFullScreen = async () => {
    try {
      const elem = containerRef.current;
      if (!elem) return;

      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }
      setIsFullScreen(true);
    } catch (err) {
      console.error('Fullscreen entry failed:', err);
      alert('Error: Fullscreen is required to access the exam portal.');
    }
  };

  const handleViolation = useCallback(
    (type: Violation['type']) => {
      const timestamp = Date.now();
      const newViolation: Violation = { type, timestamp };

      setViolations((prev) => {
        const updated = [...prev, newViolation];

        if (updated.length >= VIOLATION_LIMIT) {
          alert(
            'CRITICAL SECURITY BREACH: Multiple violations detected. Your exam is being force-submitted immediately.'
          );
          submitExam(updated);
        } else {
          const remaining = VIOLATION_LIMIT - updated.length;
          alert(
            `SECURITY VIOLATION DETECTED: ${type.replace(
              '_',
              ' '
            )}\nThis incident has been logged. Warnings remaining: ${remaining}`
          );
        }
        return updated;
      });
    },
    [user.name]
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !isSubmitting) {
        handleViolation('TAB_SWITCH');
      }
    };

    const handleWindowBlur = () => {
      if (!isSubmitting && document.visibilityState !== 'hidden') {
        handleViolation('TAB_SWITCH');
      }
    };

    const handleFullScreenChange = () => {
      const isCurrentlyFull = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      setIsFullScreen(isCurrentlyFull);
      if (!isCurrentlyFull && !isSubmitting) {
        handleViolation('FULLSCREEN_EXIT');
      }
    };

    const preventRefresh = (e: BeforeUnloadEvent) => {
      if (!isSubmitting) {
        e.preventDefault();
        e.returnValue = 'Refreshing the page is a violation.';
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
    window.addEventListener('beforeunload', preventRefresh);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          submitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
      window.removeEventListener('beforeunload', preventRefresh);
      clearInterval(timer);
    };
  }, [handleViolation, isSubmitting]);

  const submitExam = async (finalViolations = violations) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    let score = 0;
    const arraysEqual = (a: any[], b: any[]) => {
      if (!Array.isArray(a) || !Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      const sa = [...a].sort();
      const sb = [...b].sort();
      return sa.every((v, i) => v === sb[i]);
    };

    exam.questions.forEach((q) => {
      const ans = answers[q.id];
      if (q.type === 'MCQ') {
        if (ans === q.correctAnswer) score++;
      } else if (q.type === 'MSQ') {
        if (Array.isArray(q.correctAnswer) && arraysEqual(ans || [], q.correctAnswer)) score++;
      } else if (q.type === 'FIB') {
        if (typeof q.correctAnswer === 'string' && typeof ans === 'string' && ans.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) score++;
      }
    });

    // Simulated API Call
    console.log('Transmission to BlueLock Core Server Initiated...', {
      candidate: user.name,
      score,
      violations: finalViolations,
    });

    // Send submission to backend
    try {
      const payload = {
        userId: user.id,
        userName: user.name,
        examId: exam.id,
        score,
        totalQuestions: exam.questions.length,
        violations: finalViolations || [],
        startTime: startTimeRef.current,
        endTime: Date.now(),
        browser: navigator.userAgent,
        examName: exam.title,
      } as any;

      const r = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();

      alert(
        `EVALUATION COMPLETE\nFinal Score: ${score}/${exam.questions.length}\nStatus: ${
          score / exam.questions.length >= 0.5 ? 'PASSED' : 'FAILED'
        }\nReport: ${j?.reportPath || 'N/A'}`
      );
    } catch (e) {
      console.error('Submission failed', e);
      alert('Submission failed: ' + String(e));
    }

    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onFinish();
  };

  const currentQuestion = exam.questions[currentQuestionIndex];

  return (
    <div
      ref={containerRef}
      className="bg-[#0b1120] min-h-screen text-slate-100 flex flex-col relative overflow-hidden"
    >
      {/* SECURITY OVERLAY */}
      {!isFullScreen && !isSubmitting && (
        <div className="absolute inset-0 z-[100] bg-[#0b1120] flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-slate-800/80 p-10 rounded-3xl border-2 border-sky-500 shadow-[0_0_60px_rgba(14,165,233,0.15)] animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-sky-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fa-solid fa-user-shield text-4xl text-sky-400"></i>
            </div>
            <h2 className="text-3xl font-bold mb-4 tracking-tight">Security Protocol</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
              Examination environment for <b>{exam.title}</b> is ready. Click below to initiate the
              secure link. System monitoring is active.
            </p>
            <button
              onClick={enterFullScreen}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-sky-600/30"
            >
              <span>INITIATE SECURE LINK</span>
              <i className="fa-solid fa-link"></i>
            </button>
            <div className="mt-8 flex justify-center gap-4 text-xs text-slate-500 font-bold uppercase tracking-widest">
              <span className="flex items-center gap-1">
                <i className="fa-solid fa-circle text-[6px] text-green-500"></i> Local Link
              </span>
              <span className="flex items-center gap-1">
                <i className="fa-solid fa-circle text-[6px] text-green-500"></i> Anti-Cheat ON
              </span>
            </div>
          </div>
        </div>
      )}

      {/* EXAM CORE UI */}
      <div
        className={`flex flex-col flex-1 p-6 md:p-10 transition-all duration-700 ${
          !isFullScreen ? 'blur-2xl opacity-0' : 'opacity-100'
        }`}
      >
        {/* Top Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-800 pb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              {exam.title}
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs bg-sky-500/10 text-sky-400 px-2 py-1 rounded font-bold uppercase tracking-tighter border border-sky-500/20">
                Stage 1
              </span>
              <p className="text-sm text-slate-400">
                Candidate ID: <span className="text-slate-200 font-mono">{user.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <button
              onClick={() => setShowViolationLog(!showViolationLog)}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                violations.length > 0
                  ? 'bg-red-500/10 border-red-500/50 text-red-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <i className="fa-solid fa-shield-virus"></i>
              <span className="text-xs font-bold">
                LOGS: {violations.length}/{VIOLATION_LIMIT}
              </span>
            </button>

            <div
              className={`px-8 py-3 rounded-xl border-2 font-mono text-3xl shadow-inner ${
                timeLeft < 60
                  ? 'border-red-500 text-red-400 bg-red-500/5 animate-pulse'
                  : 'border-sky-500 text-sky-400 bg-sky-500/5'
              }`}
            >
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>

        {/* Question Stage */}
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full">
          {/* Progress Indicator */}
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
              Completion Progress
            </span>
            <span className="text-[10px] font-bold text-sky-400">
              {Math.round(((currentQuestionIndex + 1) / exam.questions.length) * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mb-10 overflow-hidden p-[2px]">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-700 ease-in-out shadow-[0_0_10px_rgba(14,165,233,0.5)]"
              style={{ width: `${((currentQuestionIndex + 1) / exam.questions.length) * 100}%` }}
            />
          </div>

          {/* Question Card */}
          <div className="bg-slate-800/40 border border-slate-700/50 p-8 md:p-12 rounded-[2rem] shadow-2xl relative overflow-hidden mb-8 group">
            <div className="absolute top-0 right-0 p-8 text-slate-700 opacity-20 pointer-events-none group-hover:opacity-30 transition-opacity">
              <i className="fa-solid fa-dna text-8xl"></i>
            </div>

            <span className="text-sky-500 text-xs font-bold mb-4 block uppercase tracking-[0.3em]">
              Phase {currentQuestionIndex + 1}
            </span>
            <h3 className="text-2xl md:text-3xl mb-10 leading-snug font-semibold text-white max-w-3xl">
              {currentQuestion.text}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentQuestion.type === 'FIB' ? (
              <div>
                <input
                  type="text"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                  placeholder="Type your answer here"
                />
              </div>
            ) : (
              currentQuestion.options.map((opt, idx) => {
                const isSelected = Array.isArray(answers[currentQuestion.id])
                  ? answers[currentQuestion.id].includes(idx)
                  : answers[currentQuestion.id] === idx;

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (currentQuestion.type === 'MSQ') {
                        const prev = Array.isArray(answers[currentQuestion.id]) ? answers[currentQuestion.id] : [];
                        const exists = prev.includes(idx);
                        const next = exists ? prev.filter((n: number) => n !== idx) : [...prev, idx];
                        setAnswers({ ...answers, [currentQuestion.id]: next });
                      } else {
                        setAnswers({ ...answers, [currentQuestion.id]: idx });
                      }
                    }}
                    className={`flex items-center text-left p-6 rounded-2xl border-2 transition-all duration-200 group/opt ${
                      isSelected
                        ? 'border-sky-500 bg-sky-500/10 shadow-[0_0_20px_rgba(14,165,233,0.1)]'
                        : 'border-slate-700 hover:border-slate-500 bg-slate-900/40'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center mr-4 transition-all ${
                        isSelected
                          ? 'bg-sky-500 border-sky-400 scale-110'
                          : 'bg-slate-800 border-slate-600'
                      }`}
                    >
                      <span className="text-xs font-bold text-white">
                        {String.fromCharCode(65 + idx)}
                      </span>
                    </div>
                    <span
                      className={`text-lg font-medium ${
                        isSelected ? 'text-white' : 'text-slate-400 group-hover/opt:text-slate-200'
                      }`}
                    >
                      {opt}
                    </span>
                  </button>
                );
              })
            )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center mt-auto pb-10">
            <button
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
              className="px-8 py-4 rounded-2xl border-2 border-slate-700 disabled:opacity-20 hover:bg-slate-800 transition-all font-bold text-slate-400 flex items-center gap-2"
            >
              <i className="fa-solid fa-arrow-left"></i> PREV
            </button>

            {currentQuestionIndex === exam.questions.length - 1 ? (
              <button
                onClick={() => {
                  if (confirm('Terminate session and submit for evaluation?')) submitExam();
                }}
                className="px-12 py-4 rounded-2xl bg-green-600 hover:bg-green-500 font-black text-white shadow-xl shadow-green-600/20 transition-all transform hover:scale-105 active:scale-95"
              >
                FINAL SUBMISSION
              </button>
            ) : (
              <button
                onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                className="px-12 py-4 rounded-2xl bg-sky-600 hover:bg-sky-500 font-black text-white shadow-xl shadow-sky-600/20 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                NEXT PHASE <i className="fa-solid fa-arrow-right"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Violation Log UI - Floating Overlay */}
      {showViolationLog && violations.length > 0 && (
        <div className="fixed top-24 right-6 w-80 z-[110] bg-slate-900/95 border-2 border-red-500/30 rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-right-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-black text-red-500 uppercase tracking-tighter">
              System Alert Log
            </h4>
            <button
              onClick={() => setShowViolationLog(false)}
              className="text-slate-500 hover:text-white"
            >
              <i className="fa-solid fa-times"></i>
            </button>
          </div>
          <div className="space-y-3">
            {violations.map((v, i) => (
              <div
                key={i}
                className="bg-red-500/5 border border-red-500/20 p-3 rounded-lg flex justify-between items-center"
              >
                <span className="text-[10px] font-bold text-red-400">{v.type}</span>
                <span className="text-[10px] font-mono text-slate-500">
                  {new Date(v.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamEngine;
