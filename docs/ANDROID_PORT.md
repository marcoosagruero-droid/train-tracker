# Puente a Android nativo (Kotlin)

Este proyecto corre hoy como **aplicación web instalable (PWA)** con todo el MVP
funcionando: favoritos, sistema de estaciones, `origen + destino → sentido`,
geofencing con radio/dwell/cooldown, permisos progresivos, notificaciones,
segundo plano, modo prueba y datos demo etiquetados.

El geofencing en segundo plano con `GeofencingClient` (y la notificación con la
app cerrada, sin navegador de por medio) **solo puede existir en un APK
nativo**. Este documento deja el portaje mapeado archivo por archivo y los pasos
exactos de compilación e instalación.

## 0. Qué cambia al pasar a nativo

| Capa | Estado hoy (web) | Equivalente Android |
| --- | --- | --- |
| Detección de zona | `watchPosition` + máquina de estados ENTER/DWELL/EXIT con histéresis (`geofence.ts`) | `GeofencingClient.addGeofences` + `GEOFENCE_TRANSITION_ENTER/DWELL/EXIT` |
| Segundo plano | Service Worker + seguimiento mientras el navegador lo permite | `BroadcastReceiver` (manifest) + `WorkManager` para re-registro |
| Notificación | `registration.showNotification` | `NotificationManagerCompat` + canal de notificaciones |
| Persistencia | `localStorage` | `DataStore` o Room |
| Proxy de horarios | Acción Convex `"use node"` | La misma acción (o `Retrofit` + caché en Room) |
| Permisos | `navigator.permissions` | `ActivityResultContracts.RequestMultiplePermissions` |

## 1. Mapeo archivo por archivo

| TypeScript actual | Clase Kotlin sugerida | Responsabilidad |
| --- | --- | --- |
| `src/lib/trenes/types.ts` | `model/*.kt` | `Station`, `FavoriteRoute`, `AlertSettings`, `UpcomingTrain` |
| `src/lib/trenes/stations.ts` | `data/StationRepository.kt` | Estaciones Sarmiento (nombre, lat, lng, orden, tramos) |
| `src/lib/trenes/stations.ts#resolveDirection` | `domain/ResolveDirectionUseCase.kt` | `origen + destino → sentido` |
| `src/lib/trenes/nextTrain.ts` | `domain/NextTrainCalculator.kt` | Próximo tren, cuenta regresiva, llegada |
| `src/lib/trenes/providers/*` | `data/train/TrainDataProvider.kt` | Interfaz + `HorariosTrenesProvider` + `DemoProvider` |
| `src/lib/trenes/parseHorariosTrenes.ts` | `data/train/HorariosTrenesParser.kt` | Parser del HTML (Jsoup) |
| `src/convex/trainData.ts` | igual o `data/train/HorariosTrenesClient.kt` | Descarga con caché y User-Agent |
| `src/lib/trenes/favorites.ts` | `data/RouteRepository.kt` | CRUD de favoritos |
| `src/lib/trenes/settings.ts` | `data/SettingsRepository.kt` | Radio, dwell, cooldown, reglas |
| `src/lib/trenes/geofence.ts` | `geofence/GeofenceManager.kt` | `GeofencingClient` + `GeofencingEvent` |
| `src/lib/trenes/permissions.ts` | `permission/PermissionCoordinator.kt` | Flujo progresivo FINE/BACKGROUND/POST_NOTIFICATIONS |
| `src/lib/trenes/notifier.ts` | `notify/NotificationManager.kt` | Canal + `showNotification` |
| `src/lib/trenes/alerts.ts` | `alerts/AlertEngine.kt` | Estación → recorridos → tren → reglas → aviso |
| `src/lib/trenes/store.ts` | `ui/TrenesViewModel.kt` | Estado observable (StateFlow) |
| `src/pages/**` | `ui/screens/*.kt` + Compose | Misma estructura de pantallas |

## 2. AndroidManifest mínimo

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.INTERNET" />

<application android:label="Trenes" ...>
  <receiver
      android:name=".geofence.GeofenceBroadcastReceiver"
      android:exported="false" />
  <receiver
      android:name=".geofence.BootReceiver"
      android:exported="false">
    <intent-filter>
      <action android:name="android.intent.action.BOOT_COMPLETED" />
    </intent-filter>
  </receiver>
</application>
```

### Flujo de permisos (Android 12 / Galaxy A02)

1. `ACCESS_FINE_LOCATION` (diálogo del sistema, siempre desde un `Activity`).
2. Explicación de segundo plano → recién ahí pedir
   `ACCESS_BACKGROUND_LOCATION` (en Android 11+ **no** puede mostrarse en el
   mismo diálogo que el permiso de ubicación).
3. `POST_NOTIFICATIONS` (Android 13+; en Android 12 no existe, se concede al
   instalar).
4. Si rechaza fondo: la app sigue funcionando y muestra
   `🟠 Falta permiso de ubicación en segundo plano` (ya implementado en
   `deriveAlertStatus`).

### Registro de geofences

```kotlin
val geofence = Geofence.Builder()
    .setRequestId(route.id)
    .setCircularRegion(station.lat, station.lng, settings.radiusM.toFloat())
    .setTransitionTypes(
        Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_DWELL
    )
    .setLoiteringDelay(settings.dwellSeconds * 1000)
    .setExpirationDuration(Geofence.NEVER_EXPIRE)
    .build()

GeofencingClient.getInstance(context).addGeofences(request, pendingIntent)
```

- Máximo **100 geofences** por app: acá se registran solo los **orígenes** de
  los favoritos activos, como ya hace `targetsFromFavorites()`.
- Re-registro en `BootReceiver` y en `ON_BOOT`/`MY_PACKAGE_REPLACED`, leyendo
  los favoritos de almacenamiento local (misma lógica que `syncEngine()`).
- Cooldown, dedupe por tren y evitación de spam: misma implementación que
  `evaluateStation()` en `alerts.ts` (el receiver llama a esa lógica).

## 3. Compilar e instalar el APK

> Requisitos: Android Studio (Hedgehog o superior), JDK 17, un dispositivo con
> depuración USB activada (Galaxy A02 con Android 12 funciona: minSdk 26,
> targetSdk 34).

1. Abrir Android Studio → **New Project → Empty Views Activity**
   (lenguaje **Kotlin**, build `Gradle Kotlin DSL`, minSdk **26**).
2. Nombre del paquete sugerido: `ar.trenes.app`.
3. Copiar el código de `src/lib/trenes/**` siguiendo la tabla de la sección 1
   (misma lógica, mismos nombres de caso de uso).
4. Agregar dependencias en `app/build.gradle.kts`:

   ```kotlin
   implementation("com.google.android.gms:play-services-location:21.3.0")
   implementation("androidx.work:work-runtime-ktx:2.9.1")
   implementation("androidx.datastore:datastore-preferences:1.1.1")
   implementation("com.squareup.okhttp3:okhttp:4.12.0")
   implementation("org.jsoup:jsoup:1.17.2")
   implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.6")
   ```

5. Compilar el APK:
   - **Desde Android Studio:** *Build → Build Bundle(s)/APK(s) → Build APK(s)*.
     El archivo queda en `app/build/outputs/apk/debug/app-debug.apk`.
   - **Desde terminal:**

     ```bash
     cd tu-proyecto-android
     ./gradlew assembleDebug
     ```

     APK de release (requiere keystore):

     ```bash
     ./gradlew assembleRelease
     ```

6. **Instalar en el teléfono:**

   ```bash
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```

   o copiar el `.apk` al teléfono y habilitar *Instalar apps de orígenes
   desconocidos* para el explorador que lo abre.

7. Para release firmado: *Build → Generate Signed Bundle / APK → APK →
   New keystore…* y elegir `release`.

## 4. Compatibilidad Galaxy A02 / Android 12

- `minSdk 26`, `targetSdk 34` → cubre Android 12 sin funciones de API > 31.
- Sin Always-On Display, sin servicios en primer plano agresivos: usar
  `WorkManager` para refrescar horarios en lugar de un servicio persistente.
- Notificaciones en canal propio (`trenes_alertas`, importancia `HIGH`).
- Recordar pedir `ACCESS_BACKGROUND_LOCATION` **en un paso separado**.
- Probar el modo prueba (simulador de ubicación de Android Studio o
  `adb emu geo fix <lng> <lat>`) antes de salir a la calle.

## 5. Verificación mínima del port

1. Guardar `Merlo → Liniers`.
2. Simular posición en Merlo → debe entrar al geofence.
3. Esperar el dwell → debe llegar `🚆 Cerca de Merlo … Sale en X minutos`.
4. Matar la app, simular salida y entrada de nuevo → debe volver a avisar
   respetando el cooldown.
5. Reiniciar el teléfono → los geofences deben seguir registrados.
