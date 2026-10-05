/** Core domain types. Everything in the app speaks these shapes. */

export type LineId = "sarmiento";

/** Direction of travel, expressed as the terminal the train is heading to. */
export type Sentido = "Once" | "Moreno";

/** Day type used by the timetable source. */
export type DiaTipo = "habil" | "sab" | "domFer";

/** Where the schedule numbers come from right now. */
export type DataSourceId = "live" | "demo";

export interface Station {
  id: string;
  name: string;
  /** Exact value the timetable source expects in `estacion=`. */
  sourceName: string;
  line: LineId;
  lat: number;
  lng: number;
  /** Position on the line: 0 = Once, 15 = Moreno. */
  order: number;
  /** Approximate, in metres. Used for the demo timetable only. */
  segmentToNextMin: number;
}

/** A saved trip. This is the primary configuration object of the app. */
export interface FavoriteRoute {
  id: string;
  originId: string;
  destinationId: string;
  createdAt: number;
  /** Per-route proximity alerts toggle. */
  alerts: boolean;
  note?: string;
}

export interface AlertRules {
  /** Alert as soon as the origin geofence is entered. */
  onEnter: boolean;
  within15: boolean;
  within10: boolean;
  within5: boolean;
}

export type RadiusM = 200 | 500 | 1000;
export type DwellSeconds = 0 | 15 | 30;
export type DataSourceMode = "auto" | "live" | "demo";

export interface AlertSettings {
  /** Master switch for proximity alerts. */
  alertsEnabled: boolean;
  radiusM: RadiusM;
  dwellSeconds: DwellSeconds;
  /** Minimum minutes between two alerts for the same station + route. */
  cooldownMin: number;
  rules: AlertRules;
  dataSource: DataSourceMode;
  testMode: boolean;
}

export interface ScheduleQuery {
  originId: string;
  destinationId: string;
  sentido: Sentido;
  dia: DiaTipo;
}

/** One departure as the provider understands it (HH:MM, station local time). */
export interface ScheduleEntry {
  departure: string;
  arrival: string | null;
  originStation: string;
  destinationStation: string | null;
}

export interface ScheduleBundle {
  source: DataSourceId;
  /** Human label shown in the UI badge: "horariostrenes.com.ar" or "MODO DEMO". */
  sourceLabel: string;
  fetchedAt: number;
  notices: string[];
  entries: ScheduleEntry[];
  /** Set when the live source failed and the numbers are demo data. */
  degradedReason?: string;
}

export type ServiceStatusKind = "unknown" | "notice";

export interface ServiceStatus {
  kind: ServiceStatusKind;
  label: string;
}

/** A concrete upcoming train, ready for the UI and for notifications. */
export interface UpcomingTrain {
  /** Stable key: origin + sentido + departure. Used for notification dedupe. */
  key: string;
  departureMin: number;
  arrivalMin: number | null;
  /** Minutes between now and departure (>= 0). */
  minutesAway: number;
  arrivalMinutesAway: number | null;
  originName: string;
  destinationName: string;
  sentido: Sentido;
  status: ServiceStatus;
}

/** A single GPS reading (device or simulated). */
export interface PositionFix {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
  source: "gps" | "test";
}

export type GeoStatus =
  | "off"
  | "starting"
  | "watching"
  | "permission-denied"
  | "unsupported"
  | "error";

export type PermissionKind = "granted" | "denied" | "prompt" | "unsupported";

export interface NotifyPayload {
  title: string;
  body: string;
  tag: string;
  data?: Record<string, unknown>;
}

export interface AlertRecord {
  id: string;
  stationId: string;
  routeId: string;
  at: number;
  /** Dedupe key for the specific train that triggered the alert. */
  trainKey: string;
  departureMin: number;
  minutesAway: number;
  reason: "enter" | "dwell" | "tick" | "test";
  title: string;
  body: string;
}
