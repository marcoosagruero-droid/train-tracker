import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { AlertStatusPill } from "@/components/trenes/AlertStatusPill";
import { SourceBadge } from "@/components/trenes/SourceBadge";
import { cn } from "@/lib/utils";
import { useTrenesState } from "@/hooks/use-trenes";
import {
  DWELL_OPTIONS,
  RADIUS_OPTIONS,
  enabledThresholdMinutes,
} from "@/lib/trenes/settings";
import {
  clearAllData,
  refreshPermissions,
  requestNotifications,
  updateSettings,
} from "@/lib/trenes/store";
import type { AlertSettings, DataSourceMode, RadiusM } from "@/lib/trenes/types";

/** Section 12 — alert configuration, privacy and data source. */
export default function Ajustes() {
  const state = useTrenesState();
  const { theme, setTheme } = useTheme();
  const settings = state.settings;
  const [confirmClear, setConfirmClear] = useState(false);

  const set = (patch: Partial<AlertSettings>) => updateSettings(patch);
  const thresholds = enabledThresholdMinutes(settings.rules);

  const notificationLabel =
    state.permissions.notification === "granted"
      ? "Notificaciones activadas"
      : state.permissions.notification === "denied"
        ? "Notificaciones bloqueadas"
        : state.permissions.notification === "unsupported"
          ? "Notificaciones no soportadas"
          : "Permitir notificaciones";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configuración de alertas, fuente de datos y privacidad.
        </p>
      </header>

      {/* 1. Alerts master */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Alertas por proximidad
        </h2>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3">
          <div className="min-w-0">
            <Label htmlFor="alerts-enabled" className="text-sm font-medium">
              Activar alertas
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Detecta las estaciones origen de tus recorridos y te avisa.
            </p>
          </div>
          <Switch
            id="alerts-enabled"
            checked={settings.alertsEnabled}
            onCheckedChange={(checked) => {
              set({ alertsEnabled: checked });
              if (checked) void refreshPermissions();
            }}
          />
        </div>
        <AlertStatusPill />
      </section>

      <Separator />

      {/* 2. Detection */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Detección
        </h2>

        <Field
          title="Radio de proximidad"
          description="Distancia a la estación que dispara la alerta."
        >
          <div className="flex gap-2">
            {RADIUS_OPTIONS.map((option) => (
              <Segment
                key={option.value}
                active={settings.radiusM === option.value}
                onClick={() => set({ radiusM: option.value as RadiusM })}
              >
                {option.label}
              </Segment>
            ))}
          </div>
        </Field>

        <Field
          title="Espera en la zona"
          description="Evita avisos cuando simplemente pasás cerca de la estación."
        >
          <div className="flex flex-wrap gap-2">
            {DWELL_OPTIONS.map((option) => (
              <Segment
                key={option.value}
                active={settings.dwellSeconds === option.value}
                onClick={() => set({ dwellSeconds: option.value })}
              >
                {option.label}
              </Segment>
            ))}
          </div>
        </Field>

        <Field
          title="Enfriamiento"
          description="Tiempo mínimo entre dos avisos del mismo recorrido en la misma estación."
        >
          <div className="flex flex-wrap gap-2">
            {[0, 10, 20, 30, 60].map((minutes) => (
              <Segment
                key={minutes}
                active={settings.cooldownMin === minutes}
                onClick={() => set({ cooldownMin: minutes })}
              >
                {minutes === 0 ? "Sin límite" : `${minutes} min`}
              </Segment>
            ))}
          </div>
        </Field>
      </section>

      <Separator />

      {/* 3. When to notify */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Momento de aviso
        </h2>
        <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            El aviso se genera si se cumple <strong>alguna</strong> de las condiciones
            marcadas.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <Rule
              id="rule-enter"
              checked={settings.rules.onEnter}
              onCheckedChange={(checked) => set({ rules: { ...settings.rules, onEnter: checked } })}
              label="Al entrar en la zona de la estación"
            />
            <Rule
              id="rule-15"
              checked={settings.rules.within15}
              onCheckedChange={(checked) => set({ rules: { ...settings.rules, within15: checked } })}
              label="Si el próximo tren llega en menos de 15 minutos"
            />
            <Rule
              id="rule-10"
              checked={settings.rules.within10}
              onCheckedChange={(checked) => set({ rules: { ...settings.rules, within10: checked } })}
              label="Si el próximo tren llega en menos de 10 minutos"
            />
            <Rule
              id="rule-5"
              checked={settings.rules.within5}
              onCheckedChange={(checked) => set({ rules: { ...settings.rules, within5: checked } })}
              label="Si el próximo tren llega en menos de 5 minutos"
            />
          </div>
          {thresholds.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Umbrales activos: {thresholds.join(" · ")} minutos.
            </p>
          )}
        </div>
      </section>

      <Separator />

      {/* 4. Data source */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Fuente de datos
          </h2>
          <SourceBadge sourceLabel={sourceLabel(settings.dataSource)} />
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card px-4 py-3">
          {(
            [
              ["auto", "Automática (fuente real con respaldo demo)"],
              ["live", "Solo horarios reales"],
              ["demo", "Solo datos de demostración"],
            ] as [DataSourceMode, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => set({ dataSource: value })}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                settings.dataSource === value
                  ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                  : "hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "size-3.5 rounded-full border-2",
                  settings.dataSource === value
                    ? "border-[var(--brand)] bg-[var(--brand)]"
                    : "border-border",
                )}
              />
              {label}
            </button>
          ))}
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Los horarios reales se consultan a horariostrenes.com.ar desde un proxy
            propio, con caché de 5 minutos. Cuando la fuente no responde, la app
            muestra datos de demostración claramente marcados.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Segundo plano:</strong> en la versión
            web la detección funciona mientras el navegador mantenga el seguimiento de
            ubicación y la notificación se emite desde el service worker. El APK
            nativo usa <code className="text-foreground">GeofencingClient</code> y un
            receiver en el manifiesto, que siguen funcionando con la pantalla
            apagada (ver <code className="text-foreground">docs/ANDROID_PORT.md</code>).
          </p>
        </div>
      </section>

      <Separator />

      {/* 5. Notifications */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notificaciones
        </h2>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium">{notificationLabel}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Necesarias para mostrarte el aviso con la app en segundo plano.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              const result = await requestNotifications();
              toast(
                result === "granted"
                  ? "Notificaciones activadas."
                  : result === "denied"
                    ? "Notificaciones bloqueadas. Revisá los permisos del sitio."
                    : "No se pudo solicitar el permiso.",
              );
            }}
          >
            Solicitar
          </Button>
        </div>
      </section>

      <Separator />

      {/* 6. Appearance + test mode */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Aplicación
        </h2>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3">
          <div>
            <Label htmlFor="test-mode" className="text-sm font-medium">
              Modo prueba
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Habilita la pantalla de simulación (desarrollo / testing).
            </p>
          </div>
          <Switch
            id="test-mode"
            checked={settings.testMode}
            onCheckedChange={(checked) => set({ testMode: checked })}
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium">Tema</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Claro u oscuro.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? "Claro" : "Oscuro"}
          </Button>
        </div>
      </section>

      <Separator />

      {/* 7. Privacy */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Privacidad
        </h2>
        <div className="rounded-xl border border-border/70 bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">Para qué:</strong> detectar que estás
            cerca de la estación de origen de uno de tus recorridos guardados.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Cuándo:</strong> solo mientras las
            alertas por proximidad están activadas. Si las desactivás, se detiene el
            seguimiento.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Dónde se guarda:</strong> en tu
            dispositivo. La ubicación no se envía a servidores y no se conserva
            historial de desplazamientos.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Cómo desactivarla:</strong> apagá
            «Activar alertas» en esta pantalla, o revocá el permiso de ubicación del
            sitio/aplicación.
          </p>
        </div>
      </section>

      <Separator />

      {/* 8. Data reset */}
      <section className="flex flex-col gap-3 pb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Datos
        </h2>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Borrar recorridos y alertas</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Restaura la configuración inicial de fábrica.
            </p>
          </div>
          {confirmClear ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  clearAllData();
                  setConfirmClear(false);
                  toast.success("Datos restablecidos.");
                }}
              >
                Confirmar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmClear(false)}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmClear(true)}
            >
              Restablecer
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function sourceLabel(mode: DataSourceMode): string {
  return mode === "demo" ? "MODO DEMO" : "horariostrenes.com.ar";
}

function Field({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-[var(--brand)] text-white"
          : "border-border/70 bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Rule({
  id,
  checked,
  onCheckedChange,
  label,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal leading-snug">
        {label}
      </Label>
    </div>
  );
}
