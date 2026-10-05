# Fuente de datos: horariostrenes.com.ar

Investigación realizada el 05/10/2026 sobre <https://www.horariostrenes.com.ar/>.

## 1. Cómo obtiene los horarios el sitio

| Pregunta | Resultado |
| --- | --- |
| ¿Usa JSON / XHR / API? | **No.** El HTML de resultados se genera en el servidor. |
| ¿Usa JavaScript para traer datos? | No. El JS del sitio solo maneja UI (desplegables, alternar detalle, cambiar terminal). |
| ¿Cómo se piden los horarios? | Un `GET` con parámetros de query que devuelve HTML ya renderizado. |
| ¿Hay endpoint JSON público? | Solo existe `/api/sugerencias-de-estaciones`, que **está en `robots.txt` (`Disallow`)** y por lo tanto **no se usa**. |

### Contrato descubierto

```
GET https://www.horariostrenes.com.ar/horarios-tren-sarmiento
        ?estacion=<Estación>
        &sentido=<Once|Moreno>
        &dia=<habil|sab|domFer>
```

- `estacion`: valor exacto del `<option>` del formulario, por ejemplo
  `Once`, `Merlo`, `S. A. de Padua` (el sitio usa esa abreviatura).
- `sentido`: `Once` o `Moreno` (sentido = terminal a la que llega el tren).
- `dia`: `habil` (default), `sab`, `domFer`.

### Estructura de la respuesta

```html
<div class="alerta">…obras / suspensión del servicio…</div>

<div class="nextTrains">
  <div class="horarioItem">
    <span class="horarioItemHora">10:11 hs</span>
    <span class="horarioItemTexto">En 3 minutos</span>
    <div class="detalle">
      <div class="detalleItem stationBefore">10:00: Moreno</div>
      <div class="detalleItem current">10:11: Merlo</div>      <!-- estación consultada -->
      <div class="detalleItem">10:15: S. A. de Padua</div>
      …
      <div class="detalleItem">11:20: Once</div>
    </div>
  </div>
  …
</div>

<div class="passTrains">…trenes anteriores…</div>
```

De cada `horarioItem` se extraen:

- `departure` → `horarioItemHora` (hora absoluta, **no** el texto relativo).
- `arrival` → la fila `detalleItem` cuyo nombre coincide con el destino pedido.
- `stops` → el detalle completo del viaje (origen, paradas y llegada).
- `notices` → texto del `<div class="alerta">` (obras, suspensión, etc.).

Se ignoran los `<div class="passTrains">` (trenes anteriores) y cualquier
bloque de publicidad.

## 2. Decisiones técnicas tomadas

1. **Proxy propio (CORS).** El sitio **no** devuelve cabeceras
   `access-control-allow-origin`, así que el navegador no puede pedirlo
   directamente. La consulta se hace desde la acción de Convex
   `src/convex/trainData.ts` (`"use node"`), que baja el HTML, lo parsea y
   devuelve JSON ya estructurado. El cliente nunca habla con el sitio.
2. **Parser puro y testeable.**
   `src/lib/trenes/parseHorariosTrenes.ts` no depende de navegador ni de
   Convex: corre igual en la acción, en el bundle del cliente y en scripts.
3. **Caché en el cliente (5 minutos).** Se pide una sola vez por
   estación + sentido + día y se reutiliza. El cálculo de "faltan X minutos"
   se hace en el cliente con las horas absolutas, así que el caché no vencido
   sigue siendo correcto.
4. **Se ignoran las horas relativas del servidor** (`En 3 minutos`) y se
   calculan contra el reloj local convertido a hora Argentina (UTC-3), para no
   depender de la zona horaria del dispositivo.
5. **`robots.txt` se respeta**: `/api/sugerencias-de-estaciones` y
   `/buscar-estacion` quedan bloqueados y no se consultan. No se intenta
   evadir autenticación, rate limits ni protecciones: solo se lee una página
   pública con un `GET`, con caché y User-Agent identificatorio.
6. **Fallback etiquetado.** Si la fuente falla, la app cae en datos de
   demostración marcados `MODO DEMO`; jamás presenta cifras inventadas como
   horarios publicados. Cuando un dato no existe (demora, cancelación, estado)
   se muestra "Información no disponible".

## 3. Cómo reemplazar la fuente

Todo el resto de la aplicación depende de una única interfaz:

```ts
interface TrainDataProvider {
  readonly id: "live" | "demo";
  readonly label: string;
  getSchedule(query: ScheduleQuery): Promise<ScheduleBundle>;
}
```

Implementaciones actuales:

- `src/lib/trenes/providers/live.ts` → horariostrenes.com.ar vía Convex.
- `src/lib/trenes/providers/demo.ts` → horarios de demostración.
- `src/lib/trenes/providers/index.ts` → fábrica con modos `auto | live | demo`,
  caché y fallback.

Para sumar otra fuente (API oficial, GTFS, tiempo real) alcanza con crear una
implementación nueva y registrarla en la fábrica. `ScheduleBundle` ya contempla
`notices` (avisos de servicio) y el modelo `UpcomingTrain` ya distingue
`status` con `kind: "unknown" | "notice"`, que es donde se conectarían demoras,
cancelaciones y estado del servicio en V2.

## 4. Datos que **no** están disponibles hoy

El sitio no publica demoras, cancelaciones ni posición de formaciones. Por eso
la interfaz muestra "Información no disponible" en lugar de inventar un estado.

## 5. Resultado de la conexión real (medido)

Pruebas el 05/10/2026 con la misma URL
`/horarios-tren-sarmiento?estacion=Merlo&sentido=Once&dia=habil`:

| Origen de la petición | Resultado |
| --- | --- |
| `curl` (HTTP/2) | **200** — 140 KB de HTML |
| `bun` fetch, UA descriptivo | **200** |
| `bun` fetch, UA de Chrome + `Accept-Language` | **200** |
| Node 22 `fetch` (undici, HTTP/1.1) | **200** |
| **Acción Convex `trainData:getSchedule`** | **403** (reproducido 4 veces, 2 estaciones) |

Se probaron desde Convex con UA descriptivo y con UA de Chrome +
`Accept-Language` + `Referer`: **403 en ambos casos**. Como la misma petición
desde Node local devuelve 200, el bloqueo es sobre la **IP/salida del deployment
proxy**, no sobre las cabeceras ni sobre el protocolo.

**Decisión:** no se rodea ese bloqueo (no se usa relay de terceros ni se
supera ninguna protección del sitio, tal como se pidió). El conector sigue
armado y funcionando: desde una red no bloqueada devuelve horarios reales
(verificado con `bun run verify`, que baja y parsea la fuente en vivo).

**Qué ve el usuario cuando la fuente responde 403:** el modo `auto` cae en
datos de demostración y muestra el motivo en lenguaje claro
(`humanizeSourceError`): *«La fuente de horarios rechazó la consulta desde el
servidor proxy (HTTP 403). Se muestran datos de demostración…»*, con el badge
**MODO DEMO**. En modo `solo horarios reales`, la tarjeta muestra
*«Información no disponible»* con el error.

**Cómo hacer que vuelva a dar datos reales** (sin tocar el resto de la app):
apuntar `createLiveProvider` a un backend propio cuya IP no esté bloqueada, o
sustituirlo por otra implementación de `TrainDataProvider` (API oficial, GTFS).
