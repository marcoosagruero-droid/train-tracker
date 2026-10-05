import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  FlaskConical,
  LayoutList,
  LogOut,
  Map as MapIcon,
  MapPin,
  Moon,
  Settings2,
  Sun,
  TrainFront,
} from "lucide-react";
import { useTheme } from "next-themes";
import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertStatusPill } from "@/components/trenes/AlertStatusPill";
import { SourceBadge } from "@/components/trenes/SourceBadge";
import { refreshPermissions, setLiveFetch } from "@/lib/trenes/store";
import { registerServiceWorker } from "@/lib/trenes/notifier";
import { useTrenesState, useTrenesSync } from "@/hooks/use-trenes";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Recorridos", short: "Recorridos", icon: LayoutList, end: true },
  { to: "/dashboard/horarios", label: "Horarios", short: "Horarios", icon: TrainFront, end: false },
  { to: "/dashboard/cerca", label: "Cerca de mí", short: "Cerca", icon: MapPin, end: false },
  { to: "/dashboard/mapa", label: "Mapa", short: "Mapa", icon: MapIcon, end: false },
  { to: "/dashboard/ajustes", label: "Ajustes", short: "Ajustes", icon: Settings2, end: false },
];

export default function Dashboard() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const fetchSchedule = useAction(api.trainData.getSchedule);
  const state = useTrenesState();

  useTrenesSync();

  useEffect(() => {
    // The data layer is injected here so `src/lib` stays framework-free.
    setLiveFetch((args) => fetchSchedule(args));
    void refreshPermissions();
    void registerServiceWorker();
    return () => setLiveFetch(null);
  }, [fetchSchedule]);

  const navItems = state.settings.testMode
    ? [
        ...NAV_ITEMS,
        { to: "/dashboard/prueba", label: "Prueba", short: "Prueba", icon: FlaskConical, end: false },
      ]
    : NAV_ITEMS;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-6xl">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/70 bg-card px-4 py-5 lg:flex">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 text-left"
          >
            <BrandMark />
            <span className="font-display text-lg font-semibold">Trenes</span>
          </button>

          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-3">
            <AlertStatusPill />
            <div className="flex items-center justify-between">
              <SourceBadge
                sourceLabel={sourceLabelFor(state.settings.dataSource)}
                degradedReason={
                  state.settings.dataSource === "demo"
                    ? "Elegiste datos de demostración en Ajustes."
                    : undefined
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Cambiar tema"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </Button>
          </div>
        </aside>

        {/* Main column */}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 lg:hidden"
              >
                <BrandMark />
                <span className="font-display text-base font-semibold">
                  {navItems.find((item) => isActivePath(location.pathname, item.to))?.label ??
                    "Trenes"}
                </span>
              </button>

              <div className="hidden items-center gap-2 lg:flex">
                <span className="text-sm text-muted-foreground">
                  Línea Sarmiento · Once ⇄ Moreno
                </span>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 lg:hidden"
                aria-label="Cambiar tema"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </div>
          </header>

          <main className="px-4 pb-28 pt-5 lg:px-8 lg:pb-12">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Bottom navigation (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  isActive
                    ? "text-[var(--brand-strong)]"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <item.icon className="size-5" />
              <span className="truncate">{item.short}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function BrandMark() {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--brand)] text-sm font-bold text-white">
      T
    </span>
  );
}

function sourceLabelFor(mode: "auto" | "live" | "demo"): string {
  return mode === "demo" ? "MODO DEMO" : "horariostrenes.com.ar";
}

function isActivePath(pathname: string, to: string): boolean {
  if (to === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(to);
}
