# HydroSense

Detección de fugas en una tubería PVC de 1" (lazo de 4 m) con pinzas piezoeléctricas, presión, temperatura y actuadores.

```
ESP32 adquisición ─┐                ┌─ backend (API, reglas) ─ MariaDB
                   ├─ MQTT (Mosquitto) ┤         └─ frontend (React)
ESP32 actuación  ──┘                └─ servicio de IA (Coral)
```

## Estructura

| Carpeta | Contenido |
|---|---|
| `apps/backend` | API, ingesta MQTT, reglas de alerta y retención (Node + TypeScript) |
| `apps/frontend` | Pantallas (React + Vite) |
| `services/ia` | Servicio Python con Coral (pendiente, Fase E) |
| `firmware/` | ESP32 de adquisición y de actuación (pendiente) |
| `database/` | Esquema `hydrosense.sql` y pruebas `pruebas.sql` |
| `infra/` | `docker-compose.yml` y configuración de Mosquitto |
| `docs/` | [Contrato MQTT](docs/contrato_mqtt.md), documentación de la BD y arquitectura |

## Requisitos

Node 20.19 o superior, Docker Desktop y pnpm (lo instala corepack):

```sh
corepack enable pnpm
```

Si Windows lo rechaza por permisos, usa una carpeta de tu PATH: `corepack enable --install-directory "%USERPROFILE%\bin" pnpm`.

## Cómo levantar todo

```sh
pnpm install
cp .env.example .env                              # y cambia las contraseñas
cp apps/frontend/.env.example apps/frontend/.env
pnpm db:up                                        # MariaDB y Mosquitto; carga el esquema la primera vez
pnpm seed                                         # roles, usuarios demo, tubería, pinzas y actuadores
pnpm dev:backend                                  # API en http://localhost:3000
pnpm dev:frontend                                 # pantallas en http://localhost:8443
```

Los usuarios demo son `gerencia@hydrosense.local` y `mantenimiento@hydrosense.local`, con las contraseñas `SEED_PASSWORD_*` de tu `.env`.

## Probar sin hardware

```sh
pnpm simulador                       # datos normales
pnpm simulador --fuga                # crea una alerta de fuga, correo y comandos a actuadores
pnpm simulador --sin-sensor-presion  # calidad sin_senal
pnpm simulador --duplicados          # reintentos de MQTT; no deben duplicar filas
```

Otras opciones: `--sin-sensor-temp`, `--presion-baja`, `--sin-coral`, `--fuga-tras=N`, `--segundos=N`.

Para ver los correos sin enviar nada real, levanta Mailpit y abre <http://localhost:8025>:

```sh
docker compose --env-file .env -f infra/docker-compose.yml --profile correo up -d
```

La vista de depuración está en <http://localhost:8443/?debug=1>.

## Pruebas

```sh
pnpm test      # backend (vitest), en la BD hydrosense_test
pnpm db:test   # esquema (pruebas.sql), en la BD hydrosense_tmp
```

Ninguna de las dos toca la BD `hydrosense`. `pruebas.sql` lo impide por sí mismo: fuera de `hydrosense_tmp` deja la sesión en solo lectura.

## Cambios de esquema

`CREATE TABLE IF NOT EXISTS` no modifica tablas que ya existen, y el contenedor solo carga el esquema la primera vez. Para aplicar un cambio en desarrollo hay que recrear el volumen, **lo que borra los datos**:

```sh
docker compose --env-file .env -f infra/docker-compose.yml down -v
pnpm db:up
pnpm seed
```
