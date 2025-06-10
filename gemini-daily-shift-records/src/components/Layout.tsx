import React from "react";
import { Link } from "wouter";

interface LayoutProps {
  children: React.ReactNode;
  role?: "manager" | "supervisor" | "attendant";
}

export default function Layout({ children, role }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Fuel Attendant System</h1>
        <nav className="space-x-4">
          {role === "manager" && <Link href="/manager" className="text-blue-600">Manager</Link>}
          {role === "supervisor" && <Link href="/supervisor" className="text-blue-600">Supervisor</Link>}
          {role === "attendant" && <Link href="/attendant" className="text-blue-600">Attendant</Link>}
          <Link href="/" className="text-red-500">Logout</Link>
        </nav>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
