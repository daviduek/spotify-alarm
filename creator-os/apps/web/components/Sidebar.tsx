"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/api";

const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/characters", label: "Sasha Profile" },
  { href: "/app/identity-lab", label: "Identity Lab" },
  { href: "/app/ideas", label: "Ideas" },
  { href: "/app/generator", label: "Generator" },
  { href: "/app/assets", label: "Assets" },
  { href: "/app/posts", label: "Posts" },
  { href: "/app/calendar", label: "Calendar" },
  { href: "/app/publishing", label: "Publishing" },
  { href: "/app/analytics", label: "Analytics" },
  { href: "/app/settings", label: "Settings" },
];

const ENABLED = new Set([
  "/app",
  "/app/characters",
  "/app/ideas",
  "/app/assets",
  "/app/posts",
]);

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <aside className="flex w-60 flex-col border-r border-edge bg-panel p-4">
      <div className="px-2 pb-6">
        <div className="text-xs uppercase tracking-widest text-accent">Creator OS</div>
        <div className="text-lg font-semibold text-white">Alpha · Sasha</div>
      </div>
      <nav className="flex-1 space-y-1">
        {NAV.map((item) => {
          const active =
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href);
          const enabled = ENABLED.has(item.href);
          return (
            <Link
              key={item.href}
              href={enabled ? item.href : "#"}
              className={`block rounded-lg px-3 py-2 text-sm ${
                active
                  ? "bg-ink text-white"
                  : enabled
                  ? "text-slate-300 hover:bg-ink"
                  : "cursor-not-allowed text-slate-600"
              }`}
            >
              {item.label}
              {!enabled && <span className="ml-2 text-[10px] text-slate-600">soon</span>}
            </Link>
          );
        })}
      </nav>
      <button onClick={logout} className="btn-ghost mt-4 w-full">
        Sign out
      </button>
    </aside>
  );
}
