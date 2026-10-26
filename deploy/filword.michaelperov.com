# Филворд: только статика, сервер ничего не считает.
#
# Здесь только HTTP. Строки про сертификат допишет certbot сам: класть их
# заранее нельзя - nginx не стартует со ссылкой на несуществующий файл
# сертификата и уронит ВСЕ сайты на машине.
#
# Ставится так:
#   (bob)  cp deploy/filword.michaelperov.com /etc/nginx/sites-available/
#   (bob)  ln -s /etc/nginx/sites-available/filword.michaelperov.com /etc/nginx/sites-enabled/
#   (bob)  sudo /usr/sbin/nginx -t && sudo /usr/bin/systemctl reload nginx
#   (root) mkdir -p /var/www/filword.michaelperov.com
#   (root) chown edgelab:edgelab /var/www/filword.michaelperov.com
#   (root) certbot --nginx -d filword.michaelperov.com
#   (bob)  scripts/deploy.sh
server {
    listen 80;
    listen [::]:80;
    server_name filword.michaelperov.com;

    root /var/www/filword.michaelperov.com;
    index index.html;

    # Always revalidate: the browser asks "changed?" and gets a cheap 304
    # if not. Without it a new game.js could meet an old board.js from cache.
    add_header Cache-Control "no-cache" always;

    location / {
        try_files $uri $uri/ =404;
    }

    location = /manifest.webmanifest {
        types { application/manifest+json webmanifest; }
    }

    access_log /var/log/nginx/filword.michaelperov.access.log;
}
