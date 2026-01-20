"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { AuthProvider } from "@/contexts/AuthContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen flex">
        <Sidebar />
        <main className="flex-1 bg-gray-50">{children}</main>
      </div>
    </AuthProvider>
  );
}
