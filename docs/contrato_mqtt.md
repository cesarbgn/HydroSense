# Contrato MQTT de HydroSense

Fuente de verdad de los mensajes entre los ESP32, el servicio de IA y el backend.

## Reglas generales

- **Fecha:** `ts` es siempre milisegundos epoch UTC y la pone quien mide (el ESP32, sincronizado por NTP). Así, cuando MQTT reintenta un envío, la llave única de la BD reconoce el duplicado.
- **Hora local:** el backend convierte `ts` a `DATETIME(3)` en hora de México (-06:00).
- **Presión y temperatura** se asocian a la pinza A, la más cercana al sensor.
- **Unidades:** presión en kPa (la pantalla la muestra en bar) y temperatura en °C.
- **Mensajes inválidos:** el backend los descarta y los registra en su log. Nunca detienen el proceso.
- **Fechas sin NTP:** se descarta cualquier `ts` anterior al 1 de enero de 2020.

## Calidad de una medición

| Valor de `q` | Significado | Qué guarda el backend |
|---|---|---|
| `ok` | Dato válido | El valor |
| `sin_senal` | Sensor desconectado o sin lectura | `NULL` y la calidad |
| `fuera_rango` | Lectura fuera del rango del sensor | `NULL` y la calidad |

Un valor `null` con `q: "ok"` se guarda como `sin_senal`. Una temperatura de **-127 °C** (DS18B20 desconectado) se guarda como `sin_senal` aunque el firmware la marque `ok`.

## Tópicos

| Tópico | Publica | Frecuencia | QoS y retención | Lo consume |
|---|---|---|---|---|
| `hydrosense/acq01/vibracion` | ESP32 A | 1 Hz por pinza | QoS 1 | Backend |
| `hydrosense/acq01/proceso` | ESP32 A | 1 Hz | QoS 1 | Backend |
| `hydrosense/acq01/espectro` | ESP32 A | Continuo | Binario | Servicio de IA (el backend lo ignora) |
| `hydrosense/acq01/estado` | ESP32 A | Al conectar y por LWT | Retenido | Backend |
| `hydrosense/act01/estado` | ESP32 B | Al conectar y por LWT | Retenido | Backend |
| `hydrosense/act01/cmd` | Backend | Por orden | QoS 1 | ESP32 B |
| `hydrosense/act01/ack` | ESP32 B | Por orden | QoS 1 | Backend |
| `hydrosense/pi/deteccion` | Servicio de IA | Por clasificación | QoS 1 | Backend |

## Mensajes

### `hydrosense/acq01/vibracion`

```json
{ "ts": 1793680000000, "pinza": "A", "rms": 7.1, "b1": 4.0, "b2": 5.0, "b3": 3.0, "n": 4000, "q": "ok" }
```

| Campo | Descripción |
|---|---|
| `pinza` | `"A"` o `"B"`; se busca por `pinza.nombre` |
| `rms` | RMS total |
| `b1`, `b2`, `b3` | RMS por banda: 300-700 Hz, 700-1200 Hz y 1200-2000 Hz |
| `n` | Muestras usadas, de 0 a 65535 |
| `q` | Calidad; si no es `ok`, las bandas se guardan en `NULL` |

### `hydrosense/acq01/proceso`

```json
{ "ts": 1793680000000, "presion_kpa": 180.5, "temp_c": 25.1, "q_presion": "ok", "q_temp": "ok" }
```

Si `q_presion` o `q_temp` no es `ok`, el valor correspondiente puede venir `null`.

### `hydrosense/acq01/espectro`

Binario: bins de 300-2000 Hz en int8. Lo acumula el servicio de IA en espectrogramas. El backend no lo guarda ni se suscribe.

### `hydrosense/acq01/estado` y `hydrosense/act01/estado`

Texto plano retenido: `online` u `offline`. `offline` se configura como LWT.

### `hydrosense/act01/cmd`

```json
{ "actuador": "torreta", "comando": "rojo", "id_accion": 42 }
```

| Actuador | Comandos |
|---|---|
| `torreta` | `verde`, `amarillo`, `rojo` |
| `sirena` | `encender`, `apagar` |
| `valvula` | `abrir`, `cerrar` |

### `hydrosense/act01/ack`

```json
{ "id_accion": 42, "ok": true, "ts": 1793680000500 }
```

Con `ok: true`, el backend llena `accion_actuador.confirmada_en` con `ts`. Con `ok: false` no la marca y lo registra en su log.

### `hydrosense/pi/deteccion`

```json
{ "ts": 1793680000000, "pinza": "A", "clase": "fuga", "confianza": 0.93, "version_modelo": "v0.1" }
```

| Campo | Descripción |
|---|---|
| `clase` | `fuga`, `ruido_externo` o `normal` |
| `confianza` | De 0 a 1 |
| `version_modelo` | Hasta 20 caracteres |

`normal` no se guarda: `deteccion_ia.clase` no lo admite. Sí cuenta como señal de vida del Coral y corta una racha de fuga.

## Reglas que se disparan con estos mensajes

| Regla | Condición | Resultado |
|---|---|---|
| Fuga | Detecciones `fuga` con confianza ≥ `pinza.umbral_confianza` durante 4 s seguidos | Alerta `fuga`, con las detecciones vinculadas |
| Presión baja | Presión < `pinza.umbral_presion_kpa` durante 5 s seguidos | Alerta `presion_baja` |
| Respaldo RMS | Sin detecciones durante 30 s y alguna banda sobre el doble de su mediana móvil durante 10 s | Solo un aviso en el log |

No se abre una segunda alerta del mismo tipo en la misma tubería mientras la anterior siga `activa` o `en_atencion`. Un hueco de más de 3 s entre mensajes reinicia la cuenta de una racha. Un sensor sin señal no cuenta como presión baja.
