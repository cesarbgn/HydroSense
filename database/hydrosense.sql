SET NAMES utf8mb4;
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET SESSION time_zone = '-06:00';

CREATE DATABASE IF NOT EXISTS hydrosense CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hydrosense;

CREATE TABLE IF NOT EXISTS rol (
  id_rol  TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre  VARCHAR(30)      NOT NULL,
  PRIMARY KEY (id_rol),
  UNIQUE KEY uq_rol_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario     INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  id_rol         TINYINT UNSIGNED NOT NULL,
  nombre         VARCHAR(100)     NOT NULL,
  correo         VARCHAR(254)     NOT NULL,
  password_hash  VARCHAR(255)     NOT NULL,
  activo         BOOLEAN          NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_usuario_correo (correo),
  CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES rol (id_rol)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tuberia (
  id_tuberia         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre             VARCHAR(60)   NOT NULL,
  material           ENUM('pvc','cobre','acero') NOT NULL,
  diametro_mm        DECIMAL(6,2)  NOT NULL,
  longitud_m         DECIMAL(7,3)  NOT NULL,
  umbral_caudal_lpm  DECIMAL(8,3)  NULL COMMENT 'Umbral de consumo_excesivo en L/min; se compara contra la pinza de menor posicion_m',
  PRIMARY KEY (id_tuberia),
  UNIQUE KEY uq_tuberia_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dispositivo (
  id_dispositivo   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tipo             ENUM('adquisicion','actuacion') NOT NULL,
  nombre           VARCHAR(60)  NOT NULL,
  mac              CHAR(17)     NOT NULL COMMENT 'Formato AA:BB:CC:DD:EE:FF',
  ultima_conexion  DATETIME(3)  NULL,
  activo           BOOLEAN      NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id_dispositivo),
  UNIQUE KEY uq_dispositivo_mac (mac)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pinza (
  id_pinza            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_tuberia          INT UNSIGNED NOT NULL,
  id_dispositivo      INT UNSIGNED NOT NULL,
  nombre              VARCHAR(60)  NOT NULL,
  posicion_m          DECIMAL(7,3) NOT NULL,
  umbral_confianza    DECIMAL(4,3) NOT NULL COMMENT 'De 0.000 a 1.000 (rango lo valida el backend)',
  umbral_presion_kpa  DECIMAL(7,2) NOT NULL,
  activo              BOOLEAN      NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id_pinza),
  UNIQUE KEY uq_pinza_tuberia_posicion (id_tuberia, posicion_m),
  CONSTRAINT fk_pinza_tuberia FOREIGN KEY (id_tuberia) REFERENCES tuberia (id_tuberia)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_pinza_dispositivo FOREIGN KEY (id_dispositivo) REFERENCES dispositivo (id_dispositivo)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS actuador (
  id_actuador     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_dispositivo  INT UNSIGNED NOT NULL,
  tipo            ENUM('torreta','sirena','valvula') NOT NULL,
  nombre          VARCHAR(60)  NOT NULL,
  activo          BOOLEAN      NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id_actuador),
  CONSTRAINT fk_actuador_dispositivo FOREIGN KEY (id_dispositivo) REFERENCES dispositivo (id_dispositivo)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lectura (
  id_lectura  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_pinza    INT UNSIGNED    NOT NULL,
  tipo        ENUM('presion','temperatura','caudal') NOT NULL,
  valor       DECIMAL(9,3)    NULL COMMENT 'presion en kPa, temperatura en grados C; NULL si calidad <> ok',
  calidad     ENUM('ok','sin_senal','fuera_rango') NOT NULL DEFAULT 'ok',
  fecha_hora  DATETIME(3)     NOT NULL,
  PRIMARY KEY (id_lectura),
  UNIQUE KEY uq_lectura_pinza_tipo_fecha (id_pinza, tipo, fecha_hora),
  CONSTRAINT fk_lectura_pinza FOREIGN KEY (id_pinza) REFERENCES pinza (id_pinza)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lectura_vibracion (
  id_vibracion  BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  id_pinza      INT UNSIGNED      NOT NULL,
  fecha_hora    DATETIME(3)       NOT NULL,
  rms_total     DECIMAL(10,3)     NULL,
  rms_b1        DECIMAL(10,3)     NULL COMMENT 'Banda 300-700 Hz',
  rms_b2        DECIMAL(10,3)     NULL COMMENT 'Banda 700-1200 Hz',
  rms_b3        DECIMAL(10,3)     NULL COMMENT 'Banda 1200-2000 Hz',
  n_muestras    SMALLINT UNSIGNED NOT NULL,
  calidad       ENUM('ok','sin_senal','fuera_rango') NOT NULL DEFAULT 'ok',
  PRIMARY KEY (id_vibracion),
  UNIQUE KEY uq_vibracion_pinza_fecha (id_pinza, fecha_hora),
  KEY ix_vibracion_fecha (fecha_hora),
  CONSTRAINT fk_vibracion_pinza FOREIGN KEY (id_pinza) REFERENCES pinza (id_pinza)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prueba_laboratorio (
  id_prueba        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_tuberia       INT UNSIGNED NOT NULL,
  id_usuario       INT UNSIGNED NOT NULL,
  posicion_real_m  DECIMAL(7,3) NOT NULL,
  fecha_hora       DATETIME(3)  NOT NULL,
  notas            VARCHAR(500) NULL,
  PRIMARY KEY (id_prueba),
  CONSTRAINT fk_prueba_tuberia FOREIGN KEY (id_tuberia) REFERENCES tuberia (id_tuberia)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_prueba_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS alerta (
  id_alerta            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_tuberia           INT UNSIGNED  NOT NULL,
  id_pinza_a           INT UNSIGNED  NULL,
  id_pinza_b           INT UNSIGNED  NULL,
  id_prueba            INT UNSIGNED  NULL,
  tipo                 ENUM('fuga','consumo_excesivo','presion_baja') NOT NULL,
  severidad            ENUM('baja','media','alta') NOT NULL,
  estado               ENUM('activa','en_atencion','resuelta','falsa_alarma') NOT NULL DEFAULT 'activa',
  posicion_estimada_m  DECIMAL(7,3)  NULL,
  volumen_perdido_l    DECIMAL(10,2) NULL,
  confianza            DECIMAL(4,3)  NULL,
  detectada_en         DATETIME(3)   NOT NULL,
  cerrada_en           DATETIME(3)   NULL,
  PRIMARY KEY (id_alerta),
  KEY ix_alerta_tuberia_fecha (id_tuberia, detectada_en),
  CONSTRAINT fk_alerta_tuberia FOREIGN KEY (id_tuberia) REFERENCES tuberia (id_tuberia)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_alerta_pinza_a FOREIGN KEY (id_pinza_a) REFERENCES pinza (id_pinza)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_alerta_pinza_b FOREIGN KEY (id_pinza_b) REFERENCES pinza (id_pinza)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_alerta_prueba FOREIGN KEY (id_prueba) REFERENCES prueba_laboratorio (id_prueba)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS deteccion_ia (
  id_deteccion    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_pinza        INT UNSIGNED    NOT NULL,
  id_alerta       INT UNSIGNED    NULL,
  clase           ENUM('fuga','ruido_externo','falla_sensor') NOT NULL,
  confianza       DECIMAL(4,3)    NOT NULL,
  version_modelo  VARCHAR(20)     NOT NULL,
  ruta_audio      VARCHAR(255)    NULL COMMENT 'Solo se llena cuando clase = fuga (política del backend). Al purgar la fila, el backend borra el archivo',
  fecha_hora      DATETIME(3)     NOT NULL,
  PRIMARY KEY (id_deteccion),
  KEY ix_deteccion_pinza_fecha (id_pinza, fecha_hora),
  CONSTRAINT fk_deteccion_pinza FOREIGN KEY (id_pinza) REFERENCES pinza (id_pinza)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_deteccion_alerta FOREIGN KEY (id_alerta) REFERENCES alerta (id_alerta)
    ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS atencion_alerta (
  id_atencion  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_alerta    INT UNSIGNED NOT NULL,
  id_usuario   INT UNSIGNED NOT NULL,
  estado       ENUM('activa','en_atencion','resuelta','falsa_alarma') NOT NULL,
  comentario   VARCHAR(500) NULL,
  fecha_hora   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id_atencion),
  KEY ix_atencion_alerta_fecha (id_alerta, fecha_hora),
  CONSTRAINT fk_atencion_alerta FOREIGN KEY (id_alerta) REFERENCES alerta (id_alerta)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_atencion_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notificacion (
  id_notificacion  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_alerta        INT UNSIGNED NOT NULL,
  id_usuario       INT UNSIGNED NOT NULL,
  enviada_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  estado           ENUM('enviada','fallida') NOT NULL,
  detalle_error    VARCHAR(255) NULL,
  PRIMARY KEY (id_notificacion),
  CONSTRAINT fk_notificacion_alerta FOREIGN KEY (id_alerta) REFERENCES alerta (id_alerta)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_notificacion_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS accion_actuador (
  id_accion      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_actuador    INT UNSIGNED NOT NULL,
  id_alerta      INT UNSIGNED NULL,
  id_usuario     INT UNSIGNED NULL,
  origen         ENUM('automatico','manual') NOT NULL,
  comando        ENUM('verde','amarillo','rojo','encender','apagar','abrir','cerrar') NOT NULL,
  fecha_hora     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  confirmada_en  DATETIME(3)  NULL,
  PRIMARY KEY (id_accion),
  KEY ix_accion_actuador_fecha (id_actuador, fecha_hora),
  CONSTRAINT fk_accion_actuador FOREIGN KEY (id_actuador) REFERENCES actuador (id_actuador)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_accion_alerta FOREIGN KEY (id_alerta) REFERENCES alerta (id_alerta)
    ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT fk_accion_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

INSERT INTO rol (id_rol, nombre) VALUES (1, 'gerencia'), (2, 'mantenimiento')
  ON DUPLICATE KEY UPDATE id_rol = id_rol;

-- =====================================================================
-- ORDEN DE BORRADO SEGURO (hijos antes que padres, sin desactivar FK):
--   notificacion, atencion_alerta, accion_actuador, deteccion_ia,
--   lectura_vibracion, lectura, alerta, prueba_laboratorio, actuador, pinza,
--   dispositivo, tuberia, usuario, rol
-- =====================================================================

-- =====================================================================
-- LIMPIEZA DE RETENCIÓN (la ejecuta el backend periódicamente; NO la BD).
--   lectura:           se conservan 90 días.
--   lectura_vibracion: se conservan 7 días.
--   deteccion_ia:      las que no tienen alerta se conservan 30 días; las ligadas
--                      a una alerta se conservan siempre (son evidencia).
-- Idea: se busca el primer id que se conserva recorriendo la PK solo sobre las
-- filas viejas, y se borra por rango de PK en lotes (sin escanear la tabla ni
-- bloquearla mucho tiempo). La condición extra de fecha garantiza que nunca se
-- borre una fila reciente aunque los id no sigan exactamente el orden de fechas.
-- Al buscar el corte se ignoran fechas futuras (reloj de un ESP32 sin
-- sincronizar), para que una fila así no detenga la limpieza para siempre.
-- Limitación: una fila vieja que llega tarde (id alto) sobrevive hasta que las
-- filas anteriores a ella también caduquen.
-- Si @corte queda NULL (no hay filas recientes, o la tabla está vacía), los
-- DELETE no borran nada: es el comportamiento seguro.
--
-- SET SESSION time_zone = '-06:00';
--
-- -- lectura (90 días)
-- SET @limite := NOW() - INTERVAL 90 DAY;
-- SET @corte  := (SELECT id_lectura FROM lectura
--                 WHERE fecha_hora >= @limite AND fecha_hora <= NOW()
--                 ORDER BY id_lectura LIMIT 1);
-- -- repetir mientras ROW_COUNT() > 0:
-- DELETE FROM lectura
--  WHERE id_lectura < @corte AND fecha_hora < @limite
--  LIMIT 10000;
--
-- -- lectura_vibracion (7 días)
-- SET @limite_vib := NOW() - INTERVAL 7 DAY;
-- SET @corte_vib  := (SELECT id_vibracion FROM lectura_vibracion
--                     WHERE fecha_hora >= @limite_vib AND fecha_hora <= NOW()
--                     ORDER BY id_vibracion LIMIT 1);
-- -- repetir mientras ROW_COUNT() > 0:
-- DELETE FROM lectura_vibracion
--  WHERE id_vibracion < @corte_vib AND fecha_hora < @limite_vib
--  LIMIT 10000;
--
-- -- deteccion_ia (30 días, solo las que no tienen alerta)
-- SET @limite_det := NOW() - INTERVAL 30 DAY;
-- SET @corte_det  := (SELECT id_deteccion FROM deteccion_ia
--                     WHERE fecha_hora >= @limite_det AND fecha_hora <= NOW()
--                     ORDER BY id_deteccion LIMIT 1);
-- -- antes de borrar, el backend obtiene los audios para eliminar los archivos:
-- SELECT id_deteccion, ruta_audio FROM deteccion_ia
--  WHERE id_deteccion < @corte_det AND fecha_hora < @limite_det
--    AND id_alerta IS NULL AND ruta_audio IS NOT NULL;
-- -- repetir mientras ROW_COUNT() > 0:
-- DELETE FROM deteccion_ia
--  WHERE id_deteccion < @corte_det AND fecha_hora < @limite_det
--    AND id_alerta IS NULL
--  LIMIT 10000;
-- -- después del DELETE, el backend borra del disco los archivos de ruta_audio
-- -- obtenidos en el SELECT anterior.
-- =====================================================================
