import React from "react";


interface LayoutProps {
  children: React.ReactNode;
  role?: "manager" | "supervisor" | "attendant";
}

export default function Layout({ children, }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
   
      <main className="p-6">{children}</main>
    </div>
  );
}
