import React, { useState } from 'react';
import { User } from '../types';

interface Props {
  onLogin: (user: User) => void;
}

const Login: React.FC<Props> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'student' | 'admin'>('student');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // Restrict Admin credentials
    const isAdminCred = email === '95088' || email.toLowerCase() === 'sharuadmin@gmail.com';
    if (role === 'admin' && !isAdminCred) {
      alert('Admin login is restricted. Use the designated admin registration or email.');
      return;
    }

    // For admin, ensure consistent id/email
    if (role === 'admin' && isAdminCred) {
      onLogin({
        id: '95088',
        name: 'Admin',
        email: 'sharuadmin@gmail.com',
        role: 'admin',
      });
      return;
    }

    // Student login
    onLogin({
      id: Math.random().toString(36).substr(2, 9),
      name: email.split('@')[0],
      email: email,
      role: role,
    });
  };

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="text-center mb-8">
          <i className="fa-solid fa-shield-halved text-5xl text-sky-500 mb-4"></i>
          <h2 className="text-3xl font-bold">Welcome Back</h2>
          <p className="text-slate-400 mt-2">Sign in to the BlueLock Exam Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Registration ID / Email
            </label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
              placeholder="e.g. egoist_01@bluelock.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Account Type</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`py-3 px-4 rounded-xl border transition-all flex items-center justify-center gap-2 ${
                  role === 'student'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <i className="fa-solid fa-user-graduate"></i> Student
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`py-3 px-4 rounded-xl border transition-all flex items-center justify-center gap-2 ${
                  role === 'admin'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <i className="fa-solid fa-user-gear"></i> Admin
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-sky-600/20 transition-all transform active:scale-95"
          >
            Access Portal
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
