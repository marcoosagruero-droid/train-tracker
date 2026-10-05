import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  Check,
  ChevronRight,
  Compass,
  Database,
  FlaskConical,
  Gauge,
  MapPin,
  Moon,
  ShieldCheck,
  Star,
  Sun,
  TrainFront,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Star,
    title: "Guardás el recorrido",
    body: "Merlo → Liniers. Una sola vez. La app resuelve sola la línea, la estación de origen y el sentido del tren.",
  },
  {
    icon: MapPin,
    title: "Permitís tu ubicación",
    body: "Se usan geofences alrededor de tus orígenes: sin GPS consultado cada pocos segundos.",
  },
  {
    icon: Gauge,
    title: "Entras al radio",
    body: "500 m por defecto, configurable a 200 m o 1 km, con espera en la zona para evitar falsos avisos.",
  },
  {
    icon: BellRing,
    title: "Llega el aviso",
    body: "«Estás cerca de Merlo. Merlo → Liniers. Sale en 7 minutos, a las 08:42.»",
  },
];

const FEATURES = [
  {
    icon: TrainFront,
    title: "Recorridos favoritos",
    body: "Creá, editá, borrá y activá o desactivá alertas por recorrido. Varios a la vez.",
  },
  {
    icon: Compass,
    title: "Sentido automático",
    body: "Merlo → Liniers busca hacia Once. Liniers → Merlo busca hacia Moreno. Nunca elegís el sentido a mano.",
  },
  {
    icon: Gauge,
    title: "Geofencing configurable",
    body: "Radio, espera en la zona y enfriamiento para que no te lleguen 20 avisos seguidos.",
  },
  {
    icon: ShieldCheck,
    title: "Segundo plano",
    body: "La cadena de detección no depende de que la pantalla esté encendida ni de que la app esté abierta.",
  },
  {
    icon: FlaskConical,
    title: "Modo prueba",
    body: "Simulá que entrás a Merlo sin viajar: geofence, próximo tren y notificación, con el mismo código real.",
  },
  {
    icon: Database,
    title: "Datos transparentes",
    body: "Si no hay fuente real, la app lo dice con «MODO DEMO»: nunca inventa horarios publicados.",
  },
];

const NOTIFICATION_PREVIEW = {
  title: "🚆 Cerca de Merlo",
  body: "Estás cerca de Merlo.\nMerlo → Liniers\nSale en 7 minutos, a las 08:42.",
};

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const reduceMotion = useReducedMotion();

  const primaryHref = isLoading ? "/auth" : isAuthenticated ? "/dashboard" : "/auth?returnTo=%2Fdashboard";
  const primaryLabel = isLoading ? "Cargando…" : isAuthenticated ? "Mis recorridos" : "Crear mi primer recorrido";

  const fade = {
    initial: { opacity: 0, y: reduceMotion ? 0 : 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.25 },
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--brand)] font-display text-base font-bold text-white">
              T
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">Trenes</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#como-funciona" className="transition-colors hover:text-foreground">
              Cómo funciona
            </a>
            <a href="#funciones" className="transition-colors hover:text-foreground">
              Funciones
            </a>
            <a href="#datos" className="transition-colors hover:text-foreground">
              Datos y privacidad
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Cambiar tema"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate("/auth")}>
              Ingresar
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={() => navigate(primaryHref)}>
              {primaryLabel}
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(194,102,14,0.14),transparent_62%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brand)]/50 to-transparent" />

        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-28 lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-[var(--brand)]" />
              Línea Sarmiento · Once ⇄ Moreno
            </span>

            <h1 className="font-display mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              El próximo tren,{" "}
              <span className="text-[var(--brand-strong)]">justo cuando llegás</span>{" "}
              a la estación.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Guardá un recorrido una vez —por ejemplo <strong className="font-semibold text-foreground">Merlo → Liniers</strong>—
              y Trenes se encarga del resto: estación, línea, sentido y horario. Cuando
              entrás al radio de la estación de origen, te avisa cuánto falta para el
              tren.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                size="lg"
                className="h-12 gap-2 px-6 text-base"
                onClick={() => navigate(primaryHref)}
              >
                {primaryLabel}
                <ArrowRight className="size-4" />
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-12 px-6 text-base"
                onClick={() => navigate("/auth")}
              >
                Ya tengo cuenta
              </Button>
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {["Sin registrar estaciones a mano", "Radio configurable 200 m – 1 km", "Modo prueba integrado"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-[var(--ok)]" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </motion.div>

          {/* Hero visual: notification + route card */}
          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-md"
          >
            <div className="rounded-2xl border border-border/70 bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Star className="size-4 fill-current text-[var(--brand)]" />
                  Merlo → Liniers
                </span>
                <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-strong)]">
                  hacia Once
                </span>
              </div>

              <div className="mt-4 rounded-xl bg-muted/70 p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Próximo tren
                    </p>
                    <p className="font-tabular text-4xl font-semibold leading-none">08:42</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Faltan
                    </p>
                    <p className="font-tabular text-3xl font-semibold leading-none text-[var(--brand-strong)]">
                      7 min
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2 text-xs text-muted-foreground">
                  <span>Llegada a Liniers 09:14</span>
                  <span>Normal</span>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {[
                  ["08:51", "16 min"],
                  ["09:04", "29 min"],
                ].map(([time, left]) => (
                  <div
                    key={time}
                    className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm"
                  >
                    <span className="font-tabular font-medium">{time}</span>
                    <span className="text-xs text-muted-foreground">Llega 09:23</span>
                    <span className="font-tabular text-xs font-medium text-muted-foreground">{left}</span>
                  </div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="absolute -bottom-8 -left-2 w-[19rem] max-w-[calc(100%-1rem)] rounded-2xl border border-border/70 bg-card p-3.5 sm:-left-8"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)] text-sm font-bold text-white">
                  T
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{NOTIFICATION_PREVIEW.title}</p>
                  <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                    {NOTIFICATION_PREVIEW.body}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="border-t border-border/70 bg-card/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <motion.div {...fade} className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-strong)]">
              Cómo funciona
            </p>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Cuatro pasos y no volvés a mirar el horario en la parada.
            </h2>
          </motion.div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <motion.div
                key={step.title}
                {...fade}
                transition={{ ...fade.transition, delay: index * 0.07 }}
                className="relative rounded-2xl border border-border/70 bg-card p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                    <step.icon className="size-5" />
                  </span>
                  <span className="font-tabular text-xs font-semibold text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funciones" className="border-t border-border/70">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <motion.div {...fade} className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-strong)]">
                Funciones
              </p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Lógica antes que maqueta.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Cada pieza está separada por capas —datos, estaciones, favoritos,
                geofencing, notificaciones— para poder cambiar de fuente o sumar líneas
                sin tocar el resto.
              </p>
            </div>
          </motion.div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                {...fade}
                transition={{ ...fade.transition, delay: (index % 3) * 0.06 }}
                className="rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:border-[var(--brand)]/40"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                  <feature.icon className="size-4" />
                </span>
                <h3 className="mt-4 text-base font-semibold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Data & privacy */}
      <section id="datos" className="border-t border-border/70 bg-card/50">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <motion.div {...fade}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-strong)]">
              Datos y privacidad
            </p>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Si no es publicado, no se muestra como si lo fuera.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Los horarios se consultan a horariostrenes.com.ar desde un proxy propio
              (el sitio no permite CORS), con caché para no apresurlo. Si la fuente no
              responde o elegís el modo demostración, la app lo marca con{" "}
              <span className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--brand-strong)]">
                MODO DEMO
              </span>{" "}
              y nunca presenta cifras inventadas como horarios oficiales. Cuando no hay
              dato —demora, cancelación, estado— se lee «Información no disponible».
            </p>
            <ul className="mt-5 flex flex-col gap-2.5 text-sm text-muted-foreground">
              {[
                "Tu ubicación no sale del dispositivo.",
                "No se guarda historial de desplazamientos.",
                "La ubicación solo se usa con las alertas activadas.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--ok)]" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div {...fade} transition={{ ...fade.transition, delay: 0.08 }}>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Estado del servicio</span>
                <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-strong)]">
                  MODO DEMO
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                {[
                  ["Merlo → Liniers", "08:42", "7 min"],
                  ["Merlo → Once", "08:51", "16 min"],
                  ["Moreno → Morón", "09:03", "28 min"],
                ].map(([route, time, left]) => (
                  <div
                    key={route}
                    className="flex items-center justify-between gap-3 border-b border-border/70 pb-3 last:border-0 last:pb-0"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Star className="size-3.5 shrink-0 fill-current text-[var(--brand)]" />
                      {route}
                    </span>
                    <span className="font-tabular shrink-0 font-semibold">{time}</span>
                    <span className="font-tabular w-16 shrink-0 text-right text-xs text-muted-foreground">
                      {left}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-lg bg-muted/70 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                Datos de demostración para ilustrar la interfaz. La versión con fuente
                real muestra «Fuente real» y el horario efectivamente publicado.
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BellRing className="size-4 text-[var(--brand-strong)]" />
                La notificación que vas a recibir
              </div>
              <div className="mt-3 rounded-xl border border-border/70 bg-background p-3.5">
                <p className="text-sm font-semibold">🚆 Cerca de Merlo</p>
                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                  {NOTIFICATION_PREVIEW.body}
                </p>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Se genera solo si se cumple alguna condición configurada y respeta el
                enfriamiento para no repetirse.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/70">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <motion.div
            {...fade}
            className="relative overflow-hidden rounded-3xl border border-border/70 bg-card px-6 py-12 text-center sm:px-12"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(194,102,14,0.12),transparent_65%)]" />
            <div className="relative">
              <h2 className="font-display mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Probalo sin viajar a la estación.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Activá el modo prueba, simulá que llegás a Merlo y mirá cómo se encadena
                geofence → próximo tren → notificación con el mismo código que corre con
                el GPS real.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  type="button"
                  size="lg"
                  className="h-12 gap-2 px-7 text-base"
                  onClick={() => navigate(primaryHref)}
                >
                  {primaryLabel}
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--brand)] font-display text-sm font-bold text-white">
              T
            </span>
            <div>
              <p className="text-sm font-semibold">Trenes</p>
              <p className="text-xs text-muted-foreground">
                Proyecto independiente, sin relación con Trenes Argentinos.
              </p>
            </div>
          </div>
          <p className={cn("text-xs text-muted-foreground")}>
            Datos de horarios: horariostrenes.com.ar · Línea Sarmiento Once ⇄ Moreno
          </p>
        </div>
      </footer>
    </div>
  );
}
