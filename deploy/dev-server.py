#!/usr/bin/env python3
"""Servidor local que imita al de producción, para probar antes de desplegar.

  python3 deploy/dev-server.py            # http://localhost:8099
  python3 deploy/dev-server.py 8080 --pages   # imita GitHub Pages

Modos:
  (por defecto)  como nginx/Apache con deploy/*: /@ana -> u.html con 200
  --pages        como GitHub Pages: rutas desconocidas -> 404.html con 404
                 (así se prueba que 404.html hace de router de /@ana)
"""
import http.server
import os
import re
import socketserver
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HANDLE = re.compile(r'^/@([A-Za-z0-9_-]{2,32})/?$')

SECURITY_HEADERS = {
    'Content-Security-Policy': (
        "default-src 'self'; base-uri 'self'; object-src 'none'; "
        "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; font-src 'self'; connect-src 'self'; "
        "form-action 'self'; frame-ancestors 'none'; frame-src 'none'; media-src 'self'"),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=()',
}


class Handler(http.server.SimpleHTTPRequestHandler):
    pages_mode = False

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        for k, v in SECURITY_HEADERS.items():
            self.send_header(k, v)
        super().end_headers()

    def send_head(self):
        path = self.path.split('?', 1)[0].split('#', 1)[0]

        # /@usuario -> u.html (200), como hacen nginx/Apache/Caddy en producción
        if not self.pages_mode and HANDLE.match(path):
            self.path = '/u.html'
            return super().send_head()

        full = self.translate_path(self.path)
        if not os.path.exists(full):
            # GitHub Pages (y nuestro error_page): 404.html con estado 404.
            # 404.html hace de router para /@usuario.
            body = open(os.path.join(ROOT, '404.html'), 'rb').read()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            import io
            return io.BytesIO(body)
        return super().send_head()

    def log_message(self, fmt, *args):
        sys.stderr.write('%s %s\n' % (self.address_string(), fmt % args))


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    port = int(args[0]) if args else 8099
    Handler.pages_mode = '--pages' in sys.argv
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('127.0.0.1', port), Handler) as httpd:
        modo = 'GitHub Pages (404.html hace de router)' if Handler.pages_mode else 'nginx/Apache (/@ana -> u.html, 200)'
        print('privtr.ee dev · http://localhost:%d · modo: %s' % (port, modo))
        httpd.serve_forever()
