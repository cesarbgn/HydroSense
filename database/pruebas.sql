-- =====================================================================
-- HydroSense - Pruebas del esquema (Fase A)
-- ---------------------------------------------------------------------
-- SOLO contra hydrosense_tmp: el script inserta datos, borra una alerta y
-- ejecuta la limpieza de retención. No usa el nombre de la BD: todo se consulta
-- con DATABASE().
-- Los casos negativos DEBEN fallar, así que se corre con --force. La forma
-- normal es `pnpm db:test`, que recrea hydrosense_tmp y ejecuta:
--   mariadb -u root -p --force -t hydrosense_tmp < pruebas.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- P0. Protección: nunca correr contra la BD real
-- ---------------------------------------------------------------------
-- --force hace que el cliente siga después de un error, así que un error por sí
-- solo no detiene el script. Fuera de hydrosense_tmp se da el error Y la sesión
-- queda de solo lectura, con lo que todos los INSERT/UPDATE/DELETE siguientes
-- fallan (ERROR 1792) y los datos no cambian.
SET @bd_permitida := IFNULL(DATABASE() = 'hydrosense_tmp', 0);
SET @sql_guardia  := IF(@bd_permitida, 'DO 0', 'SET SESSION TRANSACTION READ ONLY');
PREPARE guardia FROM @sql_guardia;
EXECUTE guardia;
DEALLOCATE PREPARE guardia;
SET @sql_guardia  := IF(@bd_permitida, 'DO 0',
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''pruebas.sql solo corre en hydrosense_tmp; sesion en solo lectura''');
PREPARE guardia FROM @sql_guardia;
EXECUTE guardia;
DEALLOCATE PREPARE guardia;

SET NAMES utf8mb4;
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET SESSION time_zone = '-06:00';

-- ---------------------------------------------------------------------
-- P1. Verificación del esquema
-- ---------------------------------------------------------------------
SELECT 'P1 esquema' AS prueba, DATABASE() AS bd, VERSION() AS version, @@SESSION.sql_mode AS sql_mode;

SELECT COUNT(*) AS tablas FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE';               -- esperado: 14

SELECT k.TABLE_NAME AS tabla, k.COLUMN_NAME AS columna,
       CONCAT(k.REFERENCED_TABLE_NAME, '.', k.REFERENCED_COLUMN_NAME) AS referencia,
       r.DELETE_RULE AS on_delete, r.UPDATE_RULE AS on_update
  FROM information_schema.KEY_COLUMN_USAGE k
  JOIN information_schema.REFERENTIAL_CONSTRAINTS r
    ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
 WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL
 ORDER BY k.TABLE_NAME, k.COLUMN_NAME;

SELECT COUNT(*) AS fks FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE();                                         -- esperado: 21

SELECT TABLE_NAME AS tabla, INDEX_NAME AS indice,
       GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columnas,
       IF(NON_UNIQUE = 0, 'UNIQUE', '') AS tipo
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE()
 GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
 ORDER BY TABLE_NAME, INDEX_NAME;

SHOW INDEX FROM lectura;
SHOW INDEX FROM lectura_vibracion;
SHOW INDEX FROM deteccion_ia;

-- ---------------------------------------------------------------------
-- P2. Flujo feliz completo
-- ---------------------------------------------------------------------
SELECT 'P2 flujo feliz' AS prueba;

INSERT INTO usuario (id_rol, nombre, correo, password_hash)
VALUES (2, 'Ana Mantenimiento', 'ana@hydrosense.mx', '$2b$12$hashdeprueba');
SET @u := LAST_INSERT_ID();

INSERT INTO tuberia (nombre, material, diametro_mm, longitud_m, umbral_caudal_lpm)
VALUES ('Tubería laboratorio 1', 'pvc', 25.40, 6.000, 12.500);
SET @t := LAST_INSERT_ID();

INSERT INTO dispositivo (tipo, nombre, mac) VALUES ('adquisicion', 'ESP32 adquisición', 'AA:BB:CC:DD:EE:01');
SET @d_adq := LAST_INSERT_ID();
INSERT INTO dispositivo (tipo, nombre, mac) VALUES ('actuacion', 'ESP32 actuación', 'AA:BB:CC:DD:EE:02');
SET @d_act := LAST_INSERT_ID();

INSERT INTO pinza (id_tuberia, id_dispositivo, nombre, posicion_m, umbral_confianza, umbral_presion_kpa)
VALUES (@t, @d_adq, 'Pinza A', 0.500, 0.800, 150.00);
SET @p1 := LAST_INSERT_ID();
INSERT INTO pinza (id_tuberia, id_dispositivo, nombre, posicion_m, umbral_confianza, umbral_presion_kpa)
VALUES (@t, @d_adq, 'Pinza B', 5.500, 0.800, 150.00);
SET @p2 := LAST_INSERT_ID();

INSERT INTO actuador (id_dispositivo, tipo, nombre) VALUES (@d_act, 'torreta', 'Torreta principal');
SET @act := LAST_INSERT_ID();

SET @f_lec := CAST(NOW() - INTERVAL 1 HOUR AS DATETIME(3));
INSERT INTO lectura (id_pinza, tipo, valor, fecha_hora) VALUES
  (@p1, 'presion',     101.325, @f_lec),
  (@p1, 'temperatura',  22.500, @f_lec),
  (@p1, 'caudal',        8.750, @f_lec);

INSERT INTO alerta (id_tuberia, id_pinza_a, id_pinza_b, tipo, severidad, posicion_estimada_m, confianza, detectada_en)
VALUES (@t, @p1, @p2, 'fuga', 'alta', 3.200, 0.930, NOW(3));
SET @al := LAST_INSERT_ID();

INSERT INTO deteccion_ia (id_pinza, id_alerta, clase, confianza, version_modelo, ruta_audio, fecha_hora)
VALUES (@p1, @al, 'fuga', 0.930, 'v1.0.0', '/audio/det_0001.wav', NOW(3));
SET @det := LAST_INSERT_ID();

-- atención + estado actual en la misma transacción (regla del backend)
START TRANSACTION;
INSERT INTO atencion_alerta (id_alerta, id_usuario, estado, comentario)
VALUES (@al, @u, 'en_atencion', 'Voy en camino a revisar la tubería');
UPDATE alerta SET estado = 'en_atencion' WHERE id_alerta = @al;
COMMIT;

INSERT INTO notificacion (id_alerta, id_usuario, estado) VALUES (@al, @u, 'enviada');

INSERT INTO accion_actuador (id_actuador, id_alerta, origen, comando) VALUES (@act, @al, 'automatico', 'rojo');
SET @acc := LAST_INSERT_ID();
UPDATE accion_actuador SET confirmada_en = NOW() WHERE id_accion = @acc;

SELECT t.nombre AS tuberia, p.nombre AS pinza, d.nombre AS dispositivo, l.tipo, l.valor, l.fecha_hora
  FROM lectura l
  JOIN pinza p       ON p.id_pinza = l.id_pinza
  JOIN tuberia t     ON t.id_tuberia = p.id_tuberia
  JOIN dispositivo d ON d.id_dispositivo = p.id_dispositivo
 ORDER BY l.tipo;

SELECT a.id_alerta, a.tipo, a.severidad, a.estado, t.nombre AS tuberia,
       pa.nombre AS pinza_a, pa.posicion_m AS pos_a, pb.nombre AS pinza_b, pb.posicion_m AS pos_b,
       a.posicion_estimada_m, di.clase AS deteccion, di.confianza, di.ruta_audio
  FROM alerta a
  JOIN tuberia t           ON t.id_tuberia = a.id_tuberia
  JOIN pinza pa            ON pa.id_pinza = a.id_pinza_a
  JOIN pinza pb            ON pb.id_pinza = a.id_pinza_b
  LEFT JOIN deteccion_ia di ON di.id_alerta = a.id_alerta;

SELECT a.id_alerta, aa.estado AS estado_historial, u.nombre AS usuario, r.nombre AS rol,
       aa.comentario, aa.fecha_hora
  FROM alerta a
  JOIN atencion_alerta aa ON aa.id_alerta = a.id_alerta
  JOIN usuario u          ON u.id_usuario = aa.id_usuario
  JOIN rol r              ON r.id_rol = u.id_rol;

SELECT n.id_notificacion, n.id_alerta, u.correo, n.estado, n.enviada_en, n.detalle_error
  FROM notificacion n JOIN usuario u ON u.id_usuario = n.id_usuario;

SELECT ac.id_accion, ac.id_alerta, act.tipo AS actuador, d.nombre AS dispositivo,
       ac.origen, ac.comando, ac.fecha_hora, ac.confirmada_en
  FROM accion_actuador ac
  JOIN actuador act  ON act.id_actuador = ac.id_actuador
  JOIN dispositivo d ON d.id_dispositivo = act.id_dispositivo;

-- ---------------------------------------------------------------------
-- P3. Casos negativos (cada uno DEBE dar error, salvo donde se indica)
-- ---------------------------------------------------------------------
SELECT 'P3.1 FK inexistente (id_pinza = 999999)' AS prueba;
INSERT INTO lectura (id_pinza, tipo, valor, fecha_hora) VALUES (999999, 'presion', 100, NOW(3));

SELECT 'P3.2 correo duplicado (ANA@hydrosense.mx)' AS prueba;
INSERT INTO usuario (id_rol, nombre, correo, password_hash) VALUES (1, 'Otra Ana', 'ANA@hydrosense.mx', '$2b$12$x');

SELECT 'P3.3 ENUM inválido como texto (material = plomo)' AS prueba;
INSERT INTO tuberia (nombre, material, diametro_mm, longitud_m) VALUES ('Tubería 2', 'plomo', 25.40, 6.000);

SELECT 'P3.4 deteccion_ia con clase = flujo_normal' AS prueba;
INSERT INTO deteccion_ia (id_pinza, clase, confianza, version_modelo, fecha_hora)
VALUES (@p1, 'flujo_normal', 0.990, 'v1.0.0', NOW(3));

SELECT 'P3.5 lectura duplicada (id_pinza, tipo, fecha_hora)' AS prueba;
INSERT INTO lectura (id_pinza, tipo, valor, fecha_hora) VALUES (@p1, 'presion', 999.000, @f_lec);

SELECT 'P3.5b mismo duplicado con INSERT IGNORE: sin error, solo advertencia' AS prueba;
INSERT IGNORE INTO lectura (id_pinza, tipo, valor, fecha_hora) VALUES (@p1, 'presion', 999.000, @f_lec);
SHOW WARNINGS;

SELECT 'P3.5c mismo duplicado con ON DUPLICATE KEY UPDATE: sin error' AS prueba;
INSERT INTO lectura (id_pinza, tipo, valor, fecha_hora) VALUES (@p1, 'presion', 999.000, @f_lec)
  ON DUPLICATE KEY UPDATE id_lectura = id_lectura;
SELECT ROW_COUNT() AS filas_afectadas;

SELECT COUNT(*) AS lecturas_presion_en_f_lec, MAX(valor) AS valor_conservado
  FROM lectura WHERE id_pinza = @p1 AND tipo = 'presion' AND fecha_hora = @f_lec;  -- esperado: 1, 101.325

SELECT 'P3.5d RIESGO: INSERT IGNORE con ENUM inválido se guarda como cadena vacía' AS prueba;
INSERT IGNORE INTO lectura (id_pinza, tipo, valor, fecha_hora) VALUES (@p1, 'presoin', 1.000, NOW(3));
SHOW WARNINGS;
SELECT id_lectura, CONCAT('[', tipo, ']') AS tipo_guardado FROM lectura WHERE tipo = '';
DELETE FROM lectura WHERE tipo = '';

SELECT 'P3.5e ON DUPLICATE KEY UPDATE con ENUM inválido: sí da error' AS prueba;
INSERT INTO lectura (id_pinza, tipo, valor, fecha_hora) VALUES (@p1, 'presoin', 1.000, NOW(3))
  ON DUPLICATE KEY UPDATE id_lectura = id_lectura;

SELECT 'P3.5f lectura con calidad <> ok y valor NULL: se acepta' AS prueba;
SET @f_nul := CAST(NOW() - INTERVAL 50 MINUTE AS DATETIME(3));
INSERT INTO lectura (id_pinza, tipo, valor, calidad, fecha_hora) VALUES
  (@p1, 'presion',     NULL, 'sin_senal',   @f_nul),
  (@p1, 'temperatura', NULL, 'fuera_rango', @f_nul);
SELECT tipo, valor, calidad FROM lectura WHERE fecha_hora = @f_nul ORDER BY tipo;   -- esperado: presion NULL sin_senal; temperatura NULL fuera_rango

SELECT 'P3.5g calidad omitida: DEFAULT ok' AS prueba;
SET @f_def := CAST(NOW() - INTERVAL 49 MINUTE AS DATETIME(3));
INSERT INTO lectura (id_pinza, tipo, valor, fecha_hora) VALUES (@p1, 'presion', 150.000, @f_def);
SELECT calidad FROM lectura WHERE fecha_hora = @f_def;                              -- esperado: ok

SELECT 'P3.5h calidad inválida: DEBE dar error' AS prueba;
INSERT INTO lectura (id_pinza, tipo, valor, calidad, fecha_hora) VALUES (@p1, 'presion', 1.000, 'desconectado', NOW(3));

SELECT 'P3.5i ON DUPLICATE KEY sobre una lectura con valor NULL: conserva la original' AS prueba;
INSERT INTO lectura (id_pinza, tipo, valor, calidad, fecha_hora) VALUES (@p1, 'presion', 777.000, 'ok', @f_nul)
  ON DUPLICATE KEY UPDATE id_lectura = id_lectura;
SELECT COUNT(*) AS filas, MAX(valor) AS valor, MAX(calidad) AS calidad
  FROM lectura WHERE id_pinza = @p1 AND tipo = 'presion' AND fecha_hora = @f_nul;   -- esperado: 1, NULL, sin_senal

SELECT 'P3.5j lectura_vibracion: inserción y DEFAULT ok' AS prueba;
SET @f_vib := CAST(NOW() - INTERVAL 40 MINUTE AS DATETIME(3));
INSERT INTO lectura_vibracion (id_pinza, fecha_hora, rms_total, rms_b1, rms_b2, rms_b3, n_muestras)
VALUES (@p1, @f_vib, 12.500, 3.100, 7.200, 2.200, 4000);
SELECT rms_total, rms_b2, n_muestras, calidad FROM lectura_vibracion WHERE id_pinza = @p1 AND fecha_hora = @f_vib;   -- esperado: 12.500, 7.200, 4000, ok

SELECT 'P3.5k UNIQUE de lectura_vibracion: DEBE dar error' AS prueba;
INSERT INTO lectura_vibracion (id_pinza, fecha_hora, rms_total, n_muestras) VALUES (@p1, @f_vib, 99.000, 4000);

SELECT 'P3.5l lectura_vibracion con ON DUPLICATE KEY: sin error, conserva la original' AS prueba;
INSERT INTO lectura_vibracion (id_pinza, fecha_hora, rms_total, n_muestras) VALUES (@p1, @f_vib, 99.000, 4000)
  ON DUPLICATE KEY UPDATE id_vibracion = id_vibracion;
SELECT COUNT(*) AS filas, MAX(rms_total) AS rms_total FROM lectura_vibracion WHERE id_pinza = @p1 AND fecha_hora = @f_vib;   -- esperado: 1, 12.500

SELECT 'P3.5m lectura_vibracion sin señal con bandas NULL: se acepta' AS prueba;
INSERT INTO lectura_vibracion (id_pinza, fecha_hora, n_muestras, calidad) VALUES (@p2, @f_vib, 0, 'sin_senal');
SELECT rms_total, n_muestras, calidad FROM lectura_vibracion WHERE id_pinza = @p2 AND fecha_hora = @f_vib;   -- esperado: NULL, 0, sin_senal

SELECT 'P3.5n alerta tipo presion_baja: se acepta' AS prueba;
INSERT INTO alerta (id_tuberia, id_pinza_a, tipo, severidad, detectada_en)
VALUES (@t, @p1, 'presion_baja', 'media', NOW(3));
SET @al_pres := LAST_INSERT_ID();
SELECT tipo, severidad, estado FROM alerta WHERE id_alerta = @al_pres;              -- esperado: presion_baja, media, activa
DELETE FROM alerta WHERE id_alerta = @al_pres;

SELECT 'P3.5o alerta con tipo inválido: DEBE dar error' AS prueba;
INSERT INTO alerta (id_tuberia, tipo, severidad, detectada_en) VALUES (@t, 'presion', 'media', NOW(3));

SELECT 'P3.6 pinza duplicada en la misma posición de la misma tubería' AS prueba;
INSERT INTO pinza (id_tuberia, id_dispositivo, nombre, posicion_m, umbral_confianza, umbral_presion_kpa)
VALUES (@t, @d_adq, 'Pinza A bis', 0.500, 0.800, 150.00);

SELECT 'P3.7 borrar un rol con usuarios (mantenimiento)' AS prueba;
DELETE FROM rol WHERE id_rol = 2;

SELECT 'P3.8 borrar una pinza con lecturas (Pinza C: solo tiene lecturas, no alertas)' AS prueba;
INSERT INTO pinza (id_tuberia, id_dispositivo, nombre, posicion_m, umbral_confianza, umbral_presion_kpa)
VALUES (@t, @d_adq, 'Pinza C', 3.000, 0.800, 150.00);
SET @p3 := LAST_INSERT_ID();
INSERT INTO lectura (id_pinza, tipo, valor, fecha_hora) VALUES (@p3, 'presion', 100.000, @f_lec);
DELETE FROM pinza WHERE id_pinza = @p3;

SELECT (SELECT COUNT(*) FROM rol) AS roles, (SELECT COUNT(*) FROM usuario) AS usuarios,
       (SELECT COUNT(*) FROM tuberia) AS tuberias, (SELECT COUNT(*) FROM pinza) AS pinzas,
       (SELECT COUNT(*) FROM lectura) AS lecturas, (SELECT COUNT(*) FROM deteccion_ia) AS detecciones;
       -- esperado: 2, 1, 1, 3, 7, 1

-- ---------------------------------------------------------------------
-- P4. ON DELETE al borrar una alerta
-- ---------------------------------------------------------------------
SELECT 'P4 antes de borrar la alerta' AS prueba;
SELECT (SELECT id_alerta FROM deteccion_ia    WHERE id_deteccion = @det) AS deteccion_id_alerta,
       (SELECT id_alerta FROM accion_actuador WHERE id_accion    = @acc) AS accion_id_alerta,
       (SELECT COUNT(*)  FROM atencion_alerta WHERE id_alerta    = @al)  AS atenciones,
       (SELECT COUNT(*)  FROM notificacion    WHERE id_alerta    = @al)  AS notificaciones;

DELETE FROM alerta WHERE id_alerta = @al;

SELECT 'P4 después: SET NULL en deteccion/accion, CASCADE en atencion/notificacion' AS prueba;
SELECT (SELECT id_alerta FROM deteccion_ia    WHERE id_deteccion = @det) AS deteccion_id_alerta,
       (SELECT id_alerta FROM accion_actuador WHERE id_accion    = @acc) AS accion_id_alerta,
       (SELECT COUNT(*)  FROM atencion_alerta WHERE id_alerta    = @al)  AS atenciones,
       (SELECT COUNT(*)  FROM notificacion    WHERE id_alerta    = @al)  AS notificaciones,
       (SELECT COUNT(*)  FROM deteccion_ia    WHERE id_deteccion = @det) AS deteccion_sigue,
       (SELECT COUNT(*)  FROM accion_actuador WHERE id_accion    = @acc) AS accion_sigue;

-- ---------------------------------------------------------------------
-- P5. Zona horaria y DEFAULT CURRENT_TIMESTAMP
-- ---------------------------------------------------------------------
SELECT 'P5 zona horaria' AS prueba;
SELECT @@GLOBAL.time_zone AS global_tz, @@SESSION.time_zone AS session_tz,
       @@system_time_zone AS system_tz, NOW() AS ahora_local, UTC_TIMESTAMP() AS ahora_utc;

INSERT INTO alerta (id_tuberia, tipo, severidad, volumen_perdido_l, detectada_en)
VALUES (@t, 'consumo_excesivo', 'media', 35.50, NOW(3));
SET @al2 := LAST_INSERT_ID();

INSERT INTO notificacion (id_alerta, id_usuario, estado) VALUES (@al2, @u, 'enviada');
SET @n_local := LAST_INSERT_ID();

-- Simula un servidor que se quedó en UTC (el DEFAULT usa el time_zone de la sesión)
SET SESSION time_zone = '+00:00';
INSERT INTO notificacion (id_alerta, id_usuario, estado, detalle_error)
VALUES (@al2, @u, 'fallida', 'SMTP no disponible (prueba)');
SET @n_utc := LAST_INSERT_ID();
SET SESSION time_zone = '-06:00';

SELECT id_notificacion, IF(id_notificacion = @n_local, 'sesion -06:00', 'sesion +00:00') AS insertada_con,
       enviada_en, NOW() AS ahora_local,
       TIMESTAMPDIFF(MINUTE, NOW(), enviada_en) AS minutos_vs_hora_local
  FROM notificacion WHERE id_notificacion IN (@n_local, @n_utc);

-- ---------------------------------------------------------------------
-- P6. Limpieza de retención (mismo script que el final de hydrosense.sql)
-- ---------------------------------------------------------------------
SELECT 'P6 retención: preparación de datos' AS prueba;
-- Se vacían las tablas para que los id sigan el orden de las fechas, como en
-- operación real (los datos de P2 se insertaron antes que los "viejos").
DELETE FROM lectura;
DELETE FROM lectura_vibracion;
DELETE FROM deteccion_ia;

-- lectura_vibracion: 3,000 filas de hace 10 días y 3,000 de ayer
INSERT INTO lectura_vibracion (id_pinza, fecha_hora, rms_total, n_muestras)
SELECT ELT(1 + s.seq MOD 2, @p1, @p2), CAST(NOW() - INTERVAL 10 DAY AS DATETIME(3)) + INTERVAL s.seq SECOND, 10.000, 4000
  FROM seq_0_to_2999 s;
INSERT INTO lectura_vibracion (id_pinza, fecha_hora, rms_total, n_muestras)
SELECT ELT(1 + s.seq MOD 2, @p1, @p2), CAST(NOW() - INTERVAL 1 DAY AS DATETIME(3)) + INTERVAL s.seq SECOND, 20.000, 4000
  FROM seq_0_to_2999 s;

-- lectura: 5,000 filas de hace 120 días
INSERT INTO lectura (id_pinza, tipo, valor, fecha_hora)
SELECT ELT(1 + s.seq MOD 2, @p1, @p2),
       ELT(1 + (s.seq DIV 2) MOD 3, 'presion', 'temperatura', 'caudal'),
       100.000, CAST(NOW() - INTERVAL 120 DAY AS DATETIME(3)) + INTERVAL (s.seq DIV 6) SECOND
  FROM seq_0_to_4999 s;
-- 1 fila con fecha futura (reloj de un ESP32 sin sincronizar)
INSERT INTO lectura (id_pinza, tipo, valor, fecha_hora)
VALUES (@p1, 'presion', 1.000, CAST(NOW() + INTERVAL 5 YEAR AS DATETIME(3)));
-- 5,000 filas de ayer
INSERT INTO lectura (id_pinza, tipo, valor, fecha_hora)
SELECT ELT(1 + s.seq MOD 2, @p1, @p2),
       ELT(1 + (s.seq DIV 2) MOD 3, 'presion', 'temperatura', 'caudal'),
       200.000, CAST(NOW() - INTERVAL 1 DAY AS DATETIME(3)) + INTERVAL (s.seq DIV 6) SECOND
  FROM seq_0_to_4999 s;
-- 1 fila vieja que llega tarde (id alto): limitación documentada
INSERT INTO lectura (id_pinza, tipo, valor, fecha_hora)
VALUES (@p2, 'caudal', 3.000, CAST(NOW() - INTERVAL 200 DAY AS DATETIME(3)));

-- deteccion_ia: 5,000 de hace 60 días (100 ligadas a alerta, 400 fugas con audio
-- sin alerta, el resto ruido_externo) y 5,000 de ayer
INSERT INTO deteccion_ia (id_pinza, id_alerta, clase, confianza, version_modelo, ruta_audio, fecha_hora)
SELECT ELT(1 + s.seq MOD 2, @p1, @p2),
       IF(s.seq MOD 50 = 0, @al2, NULL),
       IF(s.seq MOD 10 = 0, 'fuga', 'ruido_externo'),
       0.850, 'v1.0.0',
       IF(s.seq MOD 10 = 0, CONCAT('/audio/viejo_', s.seq, '.wav'), NULL),
       CAST(NOW() - INTERVAL 60 DAY AS DATETIME(3)) + INTERVAL s.seq SECOND
  FROM seq_0_to_4999 s;
INSERT INTO deteccion_ia (id_pinza, clase, confianza, version_modelo, fecha_hora)
SELECT ELT(1 + s.seq MOD 2, @p1, @p2), 'ruido_externo', 0.700, 'v1.0.0',
       CAST(NOW() - INTERVAL 1 DAY AS DATETIME(3)) + INTERVAL s.seq SECOND
  FROM seq_0_to_4999 s;

SELECT 'lectura antes' AS tabla, COUNT(*) AS total,
       SUM(fecha_hora < NOW() - INTERVAL 90 DAY) AS viejas_90d, SUM(fecha_hora > NOW()) AS futuras
  FROM lectura;                                                -- esperado: 10002, 5001, 1
SELECT 'deteccion_ia antes' AS tabla, COUNT(*) AS total,
       SUM(fecha_hora < NOW() - INTERVAL 30 DAY) AS viejas_30d,
       SUM(fecha_hora < NOW() - INTERVAL 30 DAY AND id_alerta IS NOT NULL) AS viejas_con_alerta
  FROM deteccion_ia;                                           -- esperado: 10000, 5000, 100

SELECT 'P6.1 @corte NULL no borra nada' AS prueba;
SET @limite := NOW() - INTERVAL 90 DAY;
SET @corte  := NULL;
DELETE FROM lectura WHERE id_lectura < @corte AND fecha_hora < @limite LIMIT 10000;
SELECT ROW_COUNT() AS borradas, (SELECT COUNT(*) FROM lectura) AS total_lectura;   -- esperado: 0, 10002

SELECT 'P6.2 retención de lectura (90 días)' AS prueba;
SET @limite := NOW() - INTERVAL 90 DAY;
SET @corte  := (SELECT id_lectura FROM lectura
                WHERE fecha_hora >= @limite AND fecha_hora <= NOW()
                ORDER BY id_lectura LIMIT 1);
SELECT @corte AS corte_lectura;
DELETE FROM lectura WHERE id_lectura < @corte AND fecha_hora < @limite LIMIT 10000;
SELECT ROW_COUNT() AS borradas_lote_1;
DELETE FROM lectura WHERE id_lectura < @corte AND fecha_hora < @limite LIMIT 10000;
SELECT ROW_COUNT() AS borradas_lote_2;                                               -- 0: termina el ciclo

SELECT 'P6.3 retención de deteccion_ia (30 días, conserva ligadas a alerta)' AS prueba;
SET @limite_det := NOW() - INTERVAL 30 DAY;
SET @corte_det  := (SELECT id_deteccion FROM deteccion_ia
                    WHERE fecha_hora >= @limite_det AND fecha_hora <= NOW()
                    ORDER BY id_deteccion LIMIT 1);
SELECT @corte_det AS corte_deteccion;
SELECT COUNT(*) AS audios_a_borrar_del_disco, MIN(ruta_audio) AS ejemplo
  FROM deteccion_ia
 WHERE id_deteccion < @corte_det AND fecha_hora < @limite_det
   AND id_alerta IS NULL AND ruta_audio IS NOT NULL;                                 -- esperado: 400
DELETE FROM deteccion_ia
 WHERE id_deteccion < @corte_det AND fecha_hora < @limite_det AND id_alerta IS NULL
 LIMIT 10000;
SELECT ROW_COUNT() AS borradas_lote_1;
DELETE FROM deteccion_ia
 WHERE id_deteccion < @corte_det AND fecha_hora < @limite_det AND id_alerta IS NULL
 LIMIT 10000;
SELECT ROW_COUNT() AS borradas_lote_2;

SELECT 'P6.4 retención de lectura_vibracion (7 días)' AS prueba;
SET @limite_vib := NOW() - INTERVAL 7 DAY;
SET @corte_vib  := (SELECT id_vibracion FROM lectura_vibracion
                    WHERE fecha_hora >= @limite_vib AND fecha_hora <= NOW()
                    ORDER BY id_vibracion LIMIT 1);
DELETE FROM lectura_vibracion WHERE id_vibracion < @corte_vib AND fecha_hora < @limite_vib LIMIT 10000;
SELECT ROW_COUNT() AS borradas_lote_1;                                               -- esperado: 3000
SELECT COUNT(*) AS vibracion_conservada FROM lectura_vibracion;                      -- esperado: 3000

SELECT 'P6 resultado' AS prueba;
SELECT 'lectura recientes' AS grupo, COUNT(*) AS filas FROM lectura WHERE fecha_hora BETWEEN NOW() - INTERVAL 90 DAY AND NOW()
UNION ALL SELECT 'lectura futura conservada', COUNT(*) FROM lectura WHERE fecha_hora > NOW()
UNION ALL SELECT 'lectura vieja tardía (sobrevive)', COUNT(*) FROM lectura WHERE fecha_hora < NOW() - INTERVAL 90 DAY
UNION ALL SELECT 'deteccion recientes', COUNT(*) FROM deteccion_ia WHERE fecha_hora >= NOW() - INTERVAL 30 DAY
UNION ALL SELECT 'deteccion vieja con alerta (conservada)', COUNT(*) FROM deteccion_ia WHERE fecha_hora < NOW() - INTERVAL 30 DAY AND id_alerta IS NOT NULL
UNION ALL SELECT 'deteccion vieja sin alerta (debe ser 0)', COUNT(*) FROM deteccion_ia WHERE fecha_hora < NOW() - INTERVAL 30 DAY AND id_alerta IS NULL;
-- esperado: 5000, 1, 1, 5000, 100, 0
