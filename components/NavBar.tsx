'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface NavBarProps {
  centerContent?: React.ReactNode;
}

export default function NavBar({ centerContent }: NavBarProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata;
      if (meta?.first_name) {
        setDisplayName(`${meta.first_name} ${meta.last_name ?? ''}`.trim());
      }
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <nav
      className="w-full flex items-center justify-between px-6 py-3 shadow-md"
      style={{ backgroundColor: '#FEFEE8' }}
    >
      <Link href="/dashboard" className="text-xl font-black tracking-tight text-gray-800">
        UNI-BUDDY
      </Link>

      {centerContent && (
        <div className="absolute left-1/2 -translate-x-1/2 text-base font-semibold text-gray-800">
          {centerContent}
        </div>
      )}

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="px-4 py-1.5 rounded-full text-sm font-semibold text-gray-800"
          style={{ backgroundColor: '#F5C842' }}
        >
          {displayName || 'Account'}
        </button>

        {open && (
          <div
            className="absolute right-0 mt-2 w-40 rounded-2xl shadow-lg overflow-hidden z-50"
            style={{ backgroundColor: '#FEFEE8', border: '1px solid #e5e7eb' }}
          >
            <button
              onClick={() => { setOpen(false); router.push('/profile'); }}
              className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-yellow-100 transition-colors"
            >
              Profile
            </button>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-yellow-100 transition-colors"
            >
              Log Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
