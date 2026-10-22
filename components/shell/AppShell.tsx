"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building, ChevronDown, Clapperboard, FolderKanban, Images, KeyRound, LayoutDashboard, LayoutGrid, LogOut,
  Menu, Printer, Settings2, ShieldCheck, SquareCheckBig, Users, Wrench, X, type LucideIcon,
} from "lucide-react";
import { api, useMe, useTypes } from "@/lib/client";
import TypeIcon from "@/components/ui/TypeIcon";
import { Avatar } from "@/components/ui/bits";
import ThemeToggle from "./ThemeToggle";
import AccountModal from "./AccountModal";

export const APP_NAME = "Studio Desk";

type NavItem = { href: string; label: string; icon: ReactNode; match?: (p: string) => boolean };

const lucide = (Icon: LucideIcon) => <Icon className="h-4 w-4" strokeWidth={2.1} />;

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const path = usePathname();
  const active = item.match ? item.match(path) : path === item.href;
  return (
    <Link href={item.href} onClick={onNavigate}
      className={`group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
        active ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:bg-panel2 hover:text-fg"
      }`}>
      <span className={active ? "" : "opacity-90 group-hover:opacity-100"}>{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function Section({ title, children, action, storageKey }: { title: string; children: ReactNode; action?: ReactNode; storageKey: string }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved collapse state after hydration
      if (localStorage.getItem(`nav:${storageKey}`) === "0") setOpen(false);
    } catch {}
  }, [storageKey]);
  function toggle() {
    setOpen(!open);
    try {
      localStorage.setItem(`nav:${storageKey}`, open ? "0" : "1");
    } catch {}
  }
  return (
    <div className="mt-3.5">
      <div className="mb-0.5 flex items-center justify-between px-2.5">
        <button onClick={toggle} className="section-title flex items-center gap-1 hover:text-fg">
          {title}
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`} />
        </button>
        {action}
      </div>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { data: me } = useMe();
  const { data: types } = useTypes();
  const router = useRouter();
  const [account, setAccount] = useState(false);
  const special = (types || []).filter((t) => t.special);
  const assetTypes = (types || []).filter((t) => t.assetTab);
  const loadingRows = !types && [0, 1, 2].map((i) => <div key={i} className="mx-2.5 my-1 h-5 animate-pulse rounded-md bg-panel2" />);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  return (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2 px-4 pt-3.5 pb-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[var(--accent-fg)]">
          <Clapperboard className="h-4 w-4" strokeWidth={2.4} />
        </span>
        <span className="text-[15px] font-extrabold tracking-tight">{APP_NAME}</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2 pt-2 pb-3">
        <div className="space-y-0.5">
          <NavLink onNavigate={onNavigate} item={{ href: "/dashboard", label: "Dashboard", icon: lucide(LayoutDashboard) }} />
          <NavLink onNavigate={onNavigate} item={{ href: "/tasks", label: "My Tasks", icon: lucide(SquareCheckBig) }} />
        </div>

        <Section title="Projects" storageKey="projects"
          action={<Link href="/projects/all?new=1" onClick={onNavigate} className="text-xs font-bold text-accent hover:underline">+ New</Link>}>
          <NavLink onNavigate={onNavigate} item={{ href: "/projects/all", label: "All projects", icon: lucide(FolderKanban), match: (p) => p === "/projects/all" || p === "/projects" }} />
          {loadingRows}
          {special.map((t) => (
            <NavLink key={t._id} onNavigate={onNavigate} item={{ href: `/projects/${t.slug}`, label: t.name, icon: <TypeIcon icon={t.icon} size="xs" /> }} />
          ))}
          <NavLink onNavigate={onNavigate} item={{ href: "/projects/others", label: "Others", icon: lucide(LayoutGrid) }} />
        </Section>

        <Section title="Assets" storageKey="assets">
          {assetTypes.map((t) => (
            <NavLink key={t._id} onNavigate={onNavigate} item={{ href: `/assets/${t.slug}`, label: `${t.name} designs`, icon: <TypeIcon icon={t.icon} size="xs" /> }} />
          ))}
          {loadingRows}
          {types && !assetTypes.length && <p className="px-2.5 py-1 text-[11px] text-muted">Turn on “Asset tab” for a product type to see it here.</p>}
        </Section>

        <Section title="Tools" storageKey="tools">
          <NavLink onNavigate={onNavigate} item={{ href: "/media-tools", label: "Media Tools", icon: lucide(Wrench) }} />
          <NavLink onNavigate={onNavigate} item={{ href: "/printers", label: "Printer Types", icon: lucide(Printer) }} />
          <NavLink onNavigate={onNavigate} item={{ href: "/credentials", label: "Credentials", icon: lucide(KeyRound) }} />
          <NavLink onNavigate={onNavigate} item={{ href: "/clients", label: "Companies & Brands", icon: lucide(Building) }} />
        </Section>

        {me?.role === "admin" && (
          <Section title="Admin" storageKey="admin">
            <NavLink onNavigate={onNavigate} item={{ href: "/product-types", label: "Product Types", icon: lucide(Settings2) }} />
            <NavLink onNavigate={onNavigate} item={{ href: "/users", label: "Users", icon: lucide(Users) }} />
          </Section>
        )}
      </nav>

      <div className="border-t border-line p-2">
        <ThemeToggle withLabel />
        <div className="flex items-center gap-2 rounded-lg px-1.5 py-1">
          <Avatar name={me?.name} size="sm" />
          <button className="min-w-0 flex-1 text-left" onClick={() => setAccount(true)} title="Change password">
            <p className="truncate text-[13px] font-bold">{me?.name || "…"}</p>
            <p className="flex items-center gap-1 text-[11px] text-muted">
              {me?.role === "admin" && <ShieldCheck className="h-3 w-3" />}
              {me?.role === "admin" ? "Admin" : "Team member"}
            </p>
          </button>
          <button className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
      <AccountModal open={account} onClose={() => setAccount(false)} />
    </div>
  );
}

const BOTTOM = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, match: (p: string) => p === "/dashboard" },
  { href: "/projects/all", label: "Projects", icon: FolderKanban, match: (p: string) => p.startsWith("/projects") || p.startsWith("/project/") },
  { href: "/tasks", label: "Tasks", icon: SquareCheckBig, match: (p: string) => p === "/tasks" },
  { href: "/assets", label: "Assets", icon: Images, match: (p: string) => p.startsWith("/assets") },
];

function SidebarSkeleton() {
  return (
    <div className="space-y-1.5 p-3">
      <div className="mb-4 h-7 w-32 animate-pulse rounded-lg bg-panel2" />
      {Array.from({ length: 10 }, (_, i) => <div key={i} className="h-6 animate-pulse rounded-md bg-panel2/70" />)}
    </div>
  );
}

function BottomNav({ onMore }: { onMore: () => void }) {
  const path = usePathname();
  return (
    <>
      {BOTTOM.map(({ href, label, icon: Icon, match }) => {
        const on = match(path);
        return (
          <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${on ? "text-accent" : "text-muted"}`}>
            <Icon className="h-5 w-5" strokeWidth={on ? 2.4 : 2} />
            {label}
          </Link>
        );
      })}
      <button onClick={onMore} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-muted">
        <Menu className="h-5 w-5" />
        More
      </button>
    </>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-2">
      <div className="mb-4 h-10 w-64 animate-pulse rounded-lg bg-panel2" />
      {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-panel2" />)}
    </div>
  );
}

/**
 * The frame (sidebar box, top bar, bottom bar) is static so it prerenders;
 * anything that reads the URL streams in behind a Suspense boundary, as
 * Cache Components requires.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] border-r border-line bg-panel lg:block">
        <Suspense fallback={<SidebarSkeleton />}><SidebarContent /></Suspense>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-1.5 border-b border-line bg-panel/90 px-2 py-1.5 backdrop-blur-lg lg:hidden">
        <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu className="h-4.5 w-4.5" /></button>
        <Link href="/dashboard" className="flex items-center gap-2 text-[15px] font-extrabold">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-[var(--accent-fg)]">
            <Clapperboard className="h-4 w-4" strokeWidth={2.4} />
          </span>
          {APP_NAME}
        </Link>
        <div className="ml-auto"><ThemeToggle /></div>
      </header>

      {/* Mobile drawer */}
      {drawer && (
        <div className="animate-fade fixed inset-0 z-[80] bg-black/50 lg:hidden" onClick={() => setDrawer(false)}>
          <aside className="relative h-full w-[80%] max-w-[260px] border-r border-line bg-panel" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn absolute top-2.5 right-2" onClick={() => setDrawer(false)} aria-label="Close menu"><X className="h-4 w-4" /></button>
            <Suspense fallback={<SidebarSkeleton />}><SidebarContent onNavigate={() => setDrawer(false)} /></Suspense>
          </aside>
        </div>
      )}

      <main className="px-3 pt-3 pb-24 sm:px-5 lg:ml-[220px] lg:px-6 lg:pt-5 lg:pb-8">
        <div className="mx-auto max-w-[1440px]"><Suspense fallback={<PageSkeleton />}>{children}</Suspense></div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden">
        <Suspense fallback={null}><BottomNav onMore={() => setDrawer(true)} /></Suspense>
      </nav>
    </div>
  );
}
