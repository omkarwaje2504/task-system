"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building, ChevronDown, Clapperboard, FlaskConical, KeyRound, LayoutGrid, LogOut,
  Menu, Palette, Printer, Settings2, ShieldCheck, Users, Wrench, X, type LucideIcon,
} from "lucide-react";
import { api, useMe, useTypes } from "@/lib/client";
import TypeIcon from "@/components/ui/TypeIcon";
import { Avatar } from "@/components/ui/bits";
import ThemeToggle from "./ThemeToggle";
import AccountModal from "./AccountModal";
import NotificationBell from "./NotificationBell";
import TaskAlert from "@/components/tasks/TaskAlert";
import { AppearanceSync } from "@/components/settings/useAppearance";
import TabIcon, { type TabIconName } from "./TabIcon";

export const APP_NAME = "Task System";

type NavItem = { href: string; label: string; icon: ReactNode; match?: (p: string) => boolean };

const lucide = (Icon: LucideIcon) => <Icon className="h-4 w-4" strokeWidth={2.1} />;
const tabIcon = (name: TabIconName) => <TabIcon name={name} className="h-4 w-4" />;

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const path = usePathname();
  const active = item.match ? item.match(path) : path === item.href;
  return (
    <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
      className={`tap group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[0.8125rem] font-medium ${
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
        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#5e5ce6] to-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
          <Clapperboard className="h-4 w-4" strokeWidth={2.4} />
        </span>
        <span className="text-[0.9375rem] font-extrabold tracking-tight">{APP_NAME}</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2 pt-2 pb-3">
        <div className="space-y-0.5">
          <NavLink onNavigate={onNavigate} item={{ href: "/dashboard", label: "Dashboard", icon: tabIcon("home") }} />
          <NavLink onNavigate={onNavigate} item={{ href: "/tasks", label: "My steps", icon: tabIcon("tasks") }} />
        </div>

        <Section title="Projects" storageKey="projects"
          action={<Link href="/projects/all?new=1" onClick={onNavigate} className="text-xs font-bold text-accent hover:underline">+ New</Link>}>
          <NavLink onNavigate={onNavigate} item={{ href: "/projects/all", label: "All projects", icon: tabIcon("projects"), match: (p) => p === "/projects/all" || p === "/projects" }} />
          <NavLink onNavigate={onNavigate} item={{ href: "/samples", label: "Samples", icon: lucide(FlaskConical), match: (p) => p.startsWith("/samples") }} />
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
          {types && !assetTypes.length && <p className="px-2.5 py-1 text-[0.6875rem] text-muted">Turn on “Asset tab” for a product type to see it here.</p>}
        </Section>

        <Section title="Tools" storageKey="tools">
          <NavLink onNavigate={onNavigate} item={{ href: "/media-tools", label: "Media Tools", icon: lucide(Wrench) }} />
          <NavLink onNavigate={onNavigate} item={{ href: "/printers", label: "Printer Types", icon: lucide(Printer) }} />
          <NavLink onNavigate={onNavigate} item={{ href: "/credentials", label: "Credentials", icon: lucide(KeyRound) }} />
          <NavLink onNavigate={onNavigate} item={{ href: "/clients", label: "Companies & Brands", icon: lucide(Building) }} />
          <NavLink onNavigate={onNavigate} item={{ href: "/settings", label: "Settings", icon: lucide(Palette) }} />
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
            <p className="truncate text-[0.8125rem] font-bold">{me?.name || "…"}</p>
            <p className="flex items-center gap-1 text-[0.6875rem] text-muted">
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

const BOTTOM: { href: string; label: string; icon: TabIconName; match: (p: string) => boolean }[] = [
  { href: "/dashboard", label: "Home", icon: "home", match: (p: string) => p === "/dashboard" },
  { href: "/projects/all", label: "Projects", icon: "projects", match: (p: string) => p.startsWith("/projects") || p.startsWith("/project/") },
  { href: "/tasks", label: "My steps", icon: "tasks", match: (p: string) => p === "/tasks" },
  { href: "/assets", label: "Assets", icon: "assets", match: (p: string) => p.startsWith("/assets") },
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
      {BOTTOM.map(({ href, label, icon, match }) => {
        const on = match(path);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={`tap flex flex-1 flex-col items-center gap-0.5 rounded-[26px] py-1.5 text-[0.625rem] font-semibold ${on ? "tab-lens text-fg" : "text-muted hover:text-fg"}`}>
            <TabIcon name={icon} />
            {label}
          </Link>
        );
      })}
      <button onClick={onMore} className="tap flex flex-1 flex-col items-center gap-0.5 rounded-[26px] py-1.5 text-[0.625rem] font-semibold text-muted">
        <TabIcon name="more" />
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
      <AppearanceSync />
      <TaskAlert />
      {/* Notifications: top-right corner on desktop (phones have it in the top bar) */}
      <div className="glass fixed top-3 right-4 z-40 hidden rounded-full p-0.5 lg:block"><NotificationBell /></div>
      {/* Desktop sidebar */}
      <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-[220px] rounded-[22px] lg:block">
        <Suspense fallback={<SidebarSkeleton />}><SidebarContent /></Suspense>
      </aside>

      {/* Mobile top bar */}
      <header className="glass glass-flat sticky top-0 z-30 flex items-center gap-1.5 !border-x-0 !border-t-0 !border-b-line px-2 py-1.5 lg:hidden">
        <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu className="h-4.5 w-4.5" /></button>
        <Link href="/dashboard" className="flex items-center gap-2 text-[0.9375rem] font-extrabold">
          <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-gradient-to-br from-[#5e5ce6] to-accent text-white">
            <Clapperboard className="h-4 w-4" strokeWidth={2.4} />
          </span>
          {APP_NAME}
        </Link>
        <div className="ml-auto flex items-center"><NotificationBell /><ThemeToggle /></div>
      </header>

      {/* Mobile drawer */}
      {drawer && (
        <div className="animate-fade fixed inset-0 z-[80] bg-black/40 lg:hidden" onClick={() => setDrawer(false)}>
          <aside className="glass absolute inset-y-2 left-2 w-[80%] max-w-[260px] rounded-[22px]" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn absolute top-2.5 right-2" onClick={() => setDrawer(false)} aria-label="Close menu"><X className="h-4 w-4" /></button>
            <Suspense fallback={<SidebarSkeleton />}><SidebarContent onNavigate={() => setDrawer(false)} /></Suspense>
          </aside>
        </div>
      )}

      <main className="px-3 pt-3 pb-28 sm:px-5 lg:ml-[232px] lg:pt-5 lg:pr-20 lg:pb-8 lg:pl-6">
        <div className="mx-auto max-w-[1440px]"><Suspense fallback={<PageSkeleton />}>{children}</Suspense></div>
      </main>

      {/* Floating tab bar, iOS style — phones and tablets only (desktop has the sidebar) */}
      <nav className="glass fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-1/2 z-30 flex w-[calc(100%-24px)] max-w-[440px] -translate-x-1/2 gap-0.5 rounded-[30px] p-1 lg:hidden">
        <Suspense fallback={null}><BottomNav onMore={() => setDrawer(true)} /></Suspense>
      </nav>
    </div>
  );
}
