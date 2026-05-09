'use client';

import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import NavBar from '@/components/NavBar';
import { mockCourses } from '@/lib/mockData';
import { createClient } from '@/lib/supabase/client';

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [courseTab, setCourseTab] = useState<'active' | 'archived'>('active');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });
  }, []);

  const meta = user?.user_metadata;
  const displayName = meta?.first_name
    ? `${meta.first_name} ${meta.last_name ?? ''}`.trim()
    : '';
  const email = user?.email ?? '';
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#8FAF76' }}>
      <NavBar />

      <main className="flex-1 p-6 flex flex-col items-center gap-6 max-w-2xl mx-auto w-full">
        {/* Avatar + name card */}
        <div
          className="w-full p-8 rounded-3xl shadow-lg flex flex-col items-center gap-4"
          style={{ backgroundColor: '#FEFEE8' }}
        >
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-md"
            style={{ backgroundColor: '#8FAF76' }}
          >
            {displayName.charAt(0) || '?'}
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-black text-gray-800">{displayName || '—'}</h1>
            <p className="text-sm text-gray-500">{email}</p>
          </div>

          {memberSince && (
            <span
              className="px-4 py-1 rounded-full text-xs font-semibold text-gray-600"
              style={{ backgroundColor: '#D6EEF8' }}
            >
              Joined {memberSince}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 w-full">
          {[
            { label: 'Courses', value: mockCourses.length },
            { label: 'Avg Mastery', value: `${Math.round(mockCourses.reduce((s, c) => s + c.mastery, 0) / mockCourses.length)}%` },
            { label: 'Study Hours', value: `${mockCourses.reduce((s, c) => s + c.timeSpent, 0).toFixed(1)}h` },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-2xl shadow flex flex-col items-center gap-1"
              style={{ backgroundColor: '#FEFEE8' }}
            >
              <span className="text-2xl font-black text-gray-800">{stat.value}</span>
              <span className="text-xs text-gray-500">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Enrolled courses */}
        <div className="w-full p-6 rounded-3xl shadow-lg flex flex-col gap-4" style={{ backgroundColor: '#FEFEE8' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">Enrolled Courses</h2>
            <div className="flex gap-1 p-1 rounded-full bg-gray-100">
              {(['active', 'archived'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCourseTab(tab)}
                  className="px-3 py-1 rounded-full text-xs font-bold capitalize transition-all"
                  style={{
                    backgroundColor: courseTab === tab ? '#F5C842' : '#FEFEE8',
                    color: '#1f2937',
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {mockCourses.filter((c) => c.isArchived === (courseTab === 'archived')).map((course) => (
              <div
                key={course.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold text-gray-700"
                    style={{ backgroundColor: '#D6EEF8' }}
                  >
                    {course.code}
                  </span>
                  <span className="text-xs text-gray-600">{course.fullName}</span>
                </div>
                <span className="text-xs font-bold text-gray-700">{course.mastery}%</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
