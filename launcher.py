"""Start the local PINPOINT LAB server without opening an unrelated service."""

import socket
import sys
import threading
import webbrowser
from functools import partial
from http.client import HTTPConnection, HTTPException
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class LocalServer(ThreadingHTTPServer):
    allow_reuse_address = False

    def server_bind(self):
        # Windows otherwise permits another SO_REUSEADDR server on the same port.
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def existing_app_matches(root, port):
    for relative in ("index.html", "app/index.html"):
        expected = (root / relative).read_bytes()
        connection = HTTPConnection("127.0.0.1", port, timeout=2)
        try:
            connection.request("GET", "/" + relative)
            response = connection.getresponse()
            if response.status != 200 or response.read(len(expected) + 1) != expected:
                return False
        except (OSError, HTTPException):
            return False
        finally:
            connection.close()
    return True


def create_server(root, port):
    for relative in ("index.html", "app/index.html", "app/vendor/html2canvas.min.js"):
        if not (root / relative).is_file():
            raise RuntimeError(f"실행 파일이 없습니다: {relative}")
    try:
        return LocalServer(("127.0.0.1", port), partial(SimpleHTTPRequestHandler, directory=str(root)))
    except OSError as error:
        if existing_app_matches(root, port):
            return None
        raise RuntimeError(f"포트 {port}을 다른 프로그램이 사용 중이거나 서버를 시작할 수 없습니다. 해당 프로그램을 확인한 뒤 다시 실행해주세요.") from error


def main():
    root = Path(__file__).resolve().parent
    port = 8761
    try:
        server = create_server(root, port)
        if server is None:
            webbrowser.open(f"http://127.0.0.1:{port}/index.html")
            print("이미 실행 중인 PINPOINT LAB을 열었습니다.")
            return 0
        with server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                if not existing_app_matches(root, port):
                    raise RuntimeError("PINPOINT LAB 실행 확인에 실패했습니다. 파일과 서버 상태를 확인해주세요.")
                webbrowser.open(f"http://127.0.0.1:{port}/index.html")
                print("PINPOINT LAB 실행 중입니다. 이 창을 닫거나 Ctrl+C를 누르면 서버가 종료됩니다.")
                thread.join()
            finally:
                server.shutdown()
                thread.join(timeout=3)
        return 0
    except KeyboardInterrupt:
        return 0
    except (OSError, RuntimeError) as error:
        print(f"실행 오류: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
