import http.server, os, sys
ROOT = sys.argv[1]
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(self):
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        super().end_headers()
    def do_GET(self):
        p = self.path.split("?")[0]
        if not os.path.exists(os.path.join(ROOT, p.lstrip("/"))) or p.endswith("/"):
            self.path = "/index.html"
        return super().do_GET()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("localhost", 8081), H).serve_forever()
