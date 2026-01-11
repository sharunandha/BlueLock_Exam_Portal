import React, { useState, useEffect } from 'react';
import { User, Exam } from './types';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import ErrorBoundary from './components/ErrorBoundary';
import ExamEngine from './components/ExamEngine';
import StudentHome from './components/StudentHome';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'LOGIN' | 'STUDENT_HOME' | 'EXAM' | 'ADMIN'>('LOGIN');
  const [activeExam, setActiveExam] = useState<Exam | null>(null);

  // Simple local "DB" simulation for frontend demo
  // In a real local Node environment, these would be API calls to Express/SQLite
  const [exams, setExams] = useState<Exam[]>([]);

  useEffect(() => {
    fetch('/api/exams')
      .then((r) => r.json())
      .then((data) => setExams(data))
      .catch(() => {
        // keep empty state if API not available
      });
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    setView(u.role === 'admin' ? 'ADMIN' : 'STUDENT_HOME');
  };

  const startExam = async (exam: Exam) => {
    // Scheduling checks
    const now = Date.now();
    if (exam.startTime && now < exam.startTime) {
      alert('Exam not yet open. Starts at: ' + new Date(exam.startTime).toLocaleString());
      return;
    }
    if (exam.endTime && now > exam.endTime) {
      alert('Exam has already closed.');
      return;
    }

    // Check if user already submitted
    try {
      const resp = await fetch(`/api/submissions/check?examId=${exam.id}&userId=${user?.id}`);
      if (resp.ok) {
        const js = await resp.json();
        if (js.submitted) return alert('You have already attempted this exam.');
      }
    } catch (e) {
      console.error('Submission check failed', e);
    }

    // Browser/Device Check
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isChromeOrEdge = /Chrome|Edg/.test(navigator.userAgent);

    if (isMobile) {
      alert('Exams are restricted to Desktop/Laptop devices only.');
      return;
    }
    if (!isChromeOrEdge) {
      alert('Please use Google Chrome or Microsoft Edge to take the exam.');
      return;
    }

    setActiveExam(exam);
    setView('EXAM');
  };

  const finishExam = () => {
    setView('STUDENT_HOME');
    setActiveExam(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-sky-500/20">
            BL
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            BlueLock <span className="text-sky-400">Portal</span>
          </h1>
        </div>
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              Logged in as: <b className="text-slate-100">{user.name}</b>
            </span>
            <button
              onClick={() => {
                setUser(null);
                setView('LOGIN');
              }}
              className="text-xs px-3 py-1 bg-slate-700 rounded hover:bg-red-500 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-4 md:p-8">
        {view === 'LOGIN' && <Login onLogin={handleLogin} />}
        {view === 'ADMIN' && (
          <ErrorBoundary>
            <AdminDashboard exams={exams} setExams={setExams} />
          </ErrorBoundary>
        )}
        {view === 'STUDENT_HOME' && <StudentHome exams={exams} onStartExam={startExam} />}
        {view === 'EXAM' && activeExam && user && (
          <ExamEngine exam={activeExam} user={user} onFinish={finishExam} />
        )}
      </main>

      <footer className="p-4 text-center text-slate-500 text-sm border-t border-slate-800">
        &copy; 2024 BlueLock Exam Portal - Secure Local Test Platform
      </footer>
    </div>
  );
};

export default App;
