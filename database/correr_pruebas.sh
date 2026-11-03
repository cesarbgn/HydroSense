#!/bin/sh
# Recrea hydrosense_tmp con el esquema vigente y corre pruebas.sql. Se ejecuta dentro
# del contenedor de MariaDB (`pnpm db:test`). Nunca toca la BD hydrosense.
set -e
export MYSQL_PWD="$MARIADB_ROOT_PASSWORD"
mariadb -u root -e "DROP DATABASE IF EXISTS hydrosense_tmp; CREATE DATABASE hydrosense_tmp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
# hydrosense.sql fija la BD con CREATE DATABASE y USE: se quitan para cargarlo en la temporal.
sed -e '/^CREATE DATABASE /d' -e '/^USE /d' /sql/hydrosense.sql | mariadb -u root hydrosense_tmp
mariadb -u root --force -t hydrosense_tmp < /sql/pruebas.sql 2>&1
