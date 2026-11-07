# ---------- 1. construiește interfața (React + Vite) ----------
FROM node:22-alpine AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- 2. server web: Apache + PHP ----------
FROM php:8.3-apache

RUN docker-php-ext-install pdo_mysql \
 && a2enmod rewrite headers expires \
 && mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY docker/app/php.ini "$PHP_INI_DIR/conf.d/zz-ascend.ini"
COPY docker/app/apache.conf /etc/apache2/sites-available/000-default.conf
COPY docker/app/entrypoint.sh /usr/local/bin/ascend-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/ascend-entrypoint && chmod +x /usr/local/bin/ascend-entrypoint

ENV ASCEND_APP_ROOT=/var/www/app
COPY api/src /var/www/app/src
COPY api/bin /var/www/app/bin
COPY api/migrations /var/www/app/migrations
COPY api/public/index.php /var/www/html/api/index.php
COPY --from=frontend /src/dist/ /var/www/html/

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD php -r 'exit(@file_get_contents("http://127.0.0.1/api/health") ? 0 : 1);'

ENTRYPOINT ["ascend-entrypoint"]
CMD ["apache2-foreground"]
