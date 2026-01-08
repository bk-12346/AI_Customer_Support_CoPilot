"use client";

import { usePathname } from "next/navigation";

const navigation = [
  { name: "Tickets", href: "/tickets", icon: "📥" },
  { name: "Knowledge", href: "/knowledge", icon: "📚" },
  { name: "Settings", href: "/settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-white border-r min-h-screen p-4">
      <div className="mb-8">
        <a href="/" className="text-xl font-bold">
          SupportAI
        </a>
      </div>

      <nav className="space-y-1">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <a
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                isActive
                  ? "bg-gray-100 text-black"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.name}</span>
            </a>
          );
        })}
      </nav>

      <div className="absolute bottom-4 left-4 right-4">
        <button className="w-full px-3 py-2 text-left text-gray-600 hover:bg-gray-50 rounded-lg transition">
          Sign out
        </button>
      </div>
    </div>
  );
}
