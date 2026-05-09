"use client";

import Link from "next/link";
import { mockUser } from "@/lib/mockData";

interface NavBarProps {
  centerContent?: React.ReactNode;
}

export default function NavBar({ centerContent }: NavBarProps) {
  return (
    <nav
      className="w-full flex items-center justify-between px-6 py-3 shadow-md"
      style={{ backgroundColor: "#FEFEE8" }}
    >
      <Link href="/dashboard" className="text-xl font-black tracking-tight text-gray-800">
        UNI-BUDDY
      </Link>

      {centerContent && (
        <div className="absolute left-1/2 -translate-x-1/2 text-base font-semibold text-gray-800">
          {centerContent}
        </div>
      )}

      <Link
        href="/profile"
        className="px-4 py-1.5 rounded-full text-sm font-semibold text-gray-800"
        style={{ backgroundColor: "#F5C842" }}
      >
        {mockUser.name}
      </Link>
    </nav>
  );
}
