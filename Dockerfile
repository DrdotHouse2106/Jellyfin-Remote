# Liefert die PWA unter dem Pfad /remote/ aus.
# Ein Reverse-Proxy (Nginx, Caddy, Traefik, Nginx Proxy Manager …) leitet
# https://jellyfin.example.de/remote/ unverändert an diesen Container weiter.
FROM nginx:1.27-alpine

COPY deploy/nginx-container.conf /etc/nginx/conf.d/default.conf
COPY app/ /usr/share/nginx/html/remote/

EXPOSE 80
