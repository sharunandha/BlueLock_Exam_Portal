import React from 'react';
import { Exam } from '../types';

interface Props {
  exams: Exam[];
  onStartExam: (exam: Exam) => void;
}

const StudentHome: React.FC<Props> = ({ exams, onStartExam }) => {
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-sky-900/40 to-slate-800 p-8 rounded-2xl border border-sky-500/20">
        <h2 className="text-3xl font-bold mb-2">Hello, Egoist.</h2>
        <p className="text-slate-300">
          Your future depends on the results of the next examination. Good luck.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.map((exam) => (
          <div
            key={exam.id}
            className="bg-slate-800 p-6 rounded-2xl border border-slate-700 hover:border-sky-500/50 transition-all group flex flex-col h-full"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-sky-500/10 rounded-xl flex items-center justify-center text-sky-400">
                <i className="fa-solid fa-clipboard-list text-xl"></i>
              </div>
              <span className="text-xs font-bold text-sky-500 bg-sky-500/10 px-2 py-1 rounded-full">
                LIVE
              </span>
            </div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-sky-400 transition-colors">
              {exam.title}
            </h3>
            <div className="flex items-center gap-4 text-sm text-slate-400 mb-6">
              <span className="flex items-center gap-1">
                <i className="fa-regular fa-clock"></i> {exam.durationMinutes}m
              </span>
              <span className="flex items-center gap-1">
                <i className="fa-solid fa-list-check"></i> {exam.questions.length} Questions
              </span>
            </div>
            <div className="mt-auto">
              <button
                onClick={() => onStartExam(exam)}
                className="w-full py-3 bg-slate-700 hover:bg-sky-600 rounded-xl font-bold transition-all transform active:scale-95 flex items-center justify-center gap-2"
              >
                Start Selection <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudentHome;
