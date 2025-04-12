import { ReactNode } from "react";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen w-screen flex flex-col bg-white text-gray-900">
      {/* Optional: Add a header/navbar here if needed */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
