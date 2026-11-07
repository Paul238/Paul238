#!/bin/sh
set -e
php /var/www/app/bin/migrate.php
exec "$@"
