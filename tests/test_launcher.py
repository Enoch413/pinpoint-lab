import importlib.util
import tempfile
import threading
import unittest
from unittest.mock import patch
from pathlib import Path
from socketserver import BaseRequestHandler, TCPServer

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('pinpoint_launcher', root / 'launcher.py')
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)

class LauncherTests(unittest.TestCase):
    def make_app(self, root, label):
        (root / 'app' / 'vendor').mkdir(parents=True)
        (root / 'index.html').write_text(label, encoding='utf-8')
        (root / 'app' / 'index.html').write_text(label + ' app', encoding='utf-8')
        (root / 'app' / 'vendor' / 'html2canvas.min.js').write_text('// test', encoding='utf-8')

    def test_new_server_reuse_and_other_app_collision(self):
        with tempfile.TemporaryDirectory(prefix='PINPOINT 한글 경로 ') as temp:
            app = Path(temp) / 'original'
            other = Path(temp) / 'other'
            self.make_app(app, 'PINPOINT synthetic')
            self.make_app(other, 'OTHER synthetic')
            with launcher.create_server(app, 0) as server:
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                port = server.server_address[1]
                try:
                    self.assertTrue(launcher.existing_app_matches(app, port))
                    self.assertIsNone(launcher.create_server(app, port))
                    with self.assertRaisesRegex(RuntimeError, '다른 프로그램'):
                        launcher.create_server(other, port)
                    self.assertTrue(launcher.existing_app_matches(app, port), 'Collision must not stop the existing server')
                finally:
                    server.shutdown()
                    thread.join()

    def test_missing_runtime_files(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(RuntimeError, '파일'):
                launcher.create_server(Path(temp), 0)

    def test_non_http_service(self):
        class OtherProtocol(BaseRequestHandler):
            def handle(self):
                self.request.recv(4096)
                self.request.sendall(b'NOT AN HTTP SERVICE\r\n')

        with tempfile.TemporaryDirectory() as temp, TCPServer(('127.0.0.1', 0), OtherProtocol) as other:
            app = Path(temp) / 'app'
            self.make_app(app, 'PINPOINT synthetic')
            thread = threading.Thread(target=other.serve_forever, daemon=True)
            thread.start()
            try:
                with self.assertRaisesRegex(RuntimeError, '다른 프로그램'):
                    launcher.create_server(app, other.server_address[1])
            finally:
                other.shutdown()
                thread.join()

    def test_failed_start_does_not_open_browser(self):
        with patch.object(launcher, 'create_server', side_effect=RuntimeError('Synthetic collision')), patch.object(launcher.webbrowser, 'open') as browser, patch('sys.stderr'):
            self.assertEqual(launcher.main(), 1)
            browser.assert_not_called()

if __name__ == '__main__':
    unittest.main()
