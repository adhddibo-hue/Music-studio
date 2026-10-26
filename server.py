#!/usr/bin/env python3
import hashlib
import hmac
import argparse
import json
import os
import re
import secrets
import sqlite3
import time
import threading
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
DATABASE = Path(os.environ.get("NIGHTSHIFT_DATABASE", ROOT / "data" / "nightshift.sqlite3"))
PBKDF2_ITERATIONS = 600_000
SESSION_LIFETIME = 30 * 24 * 60 * 60
MAX_REQUEST_BYTES = 5 * 1024 * 1024
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{3,24}$")
COOKIE_SECURE = os.environ.get("NIGHTSHIFT_COOKIE_SECURE", "0") == "1"
PUBLIC_SCHEME = os.environ.get(
    "NIGHTSHIFT_PUBLIC_SCHEME", "https" if COOKIE_SECURE else "http"
)


def connect_database():
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database():
    with connect_database() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash BLOB NOT NULL,
                password_salt BLOB NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash BLOB PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS song_libraries (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                songs_json TEXT NOT NULL DEFAULT '[]',
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS public_songs (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                song_id TEXT NOT NULL,
                song_json TEXT NOT NULL,
                published_at INTEGER NOT NULL,
                PRIMARY KEY (user_id, song_id)
            );
            CREATE TABLE IF NOT EXISTS recovery_keys (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                key_hash BLOB NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
            """
        )


class StudioHandler(SimpleHTTPRequestHandler):
    server_version = "NightshiftStudio"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} - {fmt % args}")

    def send_json(self, status, payload, headers=None):
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if headers:
            for name, value in headers.items():
                self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ValueError("Invalid request size.") from error
        if length <= 0 or length > MAX_REQUEST_BYTES:
            raise ValueError("Request is empty or too large.")
        if "application/json" not in self.headers.get("Content-Type", "").lower():
            raise ValueError("Expected a JSON request.")
        try:
            return json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise ValueError("Invalid JSON.") from error

    def check_same_origin(self):
        origin = self.headers.get("Origin")
        if not origin:
            return True
        parsed_origin = urlsplit(origin)
        return (
            parsed_origin.scheme.lower() == PUBLIC_SCHEME
            and parsed_origin.netloc.lower() == self.headers.get("Host", "").lower()
        )

    def get_user(self, connection):
        cookies = SimpleCookie(self.headers.get("Cookie", ""))
        cookie = cookies.get("nightshift_session")
        if cookie is None:
            return None
        token_hash = hashlib.sha256(cookie.value.encode("utf-8")).digest()
        row = connection.execute(
            """
            SELECT users.id, users.username
            FROM sessions JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ? AND sessions.expires_at > ?
            """,
            (token_hash, int(time.time())),
        ).fetchone()
        return row

    def set_session_cookie(self, token):
        cookie = (
            f"nightshift_session={token}; Path=/; HttpOnly; SameSite=Strict; "
            f"Max-Age={SESSION_LIFETIME}"
        )
        if COOKIE_SECURE:
            cookie += "; Secure"
        return {"Set-Cookie": cookie}

    def clear_session_cookie(self):
        cookie = "nightshift_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
        if COOKIE_SECURE:
            cookie += "; Secure"
        return {"Set-Cookie": cookie}

    def create_session(self, connection, user_id):
        token = secrets.token_urlsafe(32)
        connection.execute(
            "INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            (
                hashlib.sha256(token.encode("utf-8")).digest(),
                user_id,
                int(time.time()) + SESSION_LIFETIME,
            ),
        )
        return token

    def do_GET(self):
        if self.path == "/api/session":
            with connect_database() as connection:
                user = self.get_user(connection)
            if user is None:
                self.send_json(200, {"user": None})
            else:
                self.send_json(200, {"user": {"username": user["username"]}})
            return
        if self.path == "/api/songs":
            with connect_database() as connection:
                user = self.get_user(connection)
                if user is None:
                    self.send_json(401, {"error": "Please sign in again."})
                    return
                row = connection.execute(
                    "SELECT songs_json FROM song_libraries WHERE user_id = ?",
                    (user["id"],),
                ).fetchone()
                public_rows = connection.execute(
                    "SELECT song_id FROM public_songs WHERE user_id = ?",
                    (user["id"],),
                ).fetchall()
            public_ids = {item["song_id"] for item in public_rows}
            songs = json.loads(row["songs_json"]) if row else []
            for song in songs:
                song["isPublic"] = song["id"] in public_ids
            self.send_json(200, {"songs": songs})
            return
        if self.path == "/api/public-songs":
            with connect_database() as connection:
                user = self.get_user(connection)
                if user is None:
                    self.send_json(401, {"error": "Please sign in again."})
                    return
                rows = connection.execute(
                    """
                    SELECT users.username, public_songs.song_json, public_songs.published_at
                    FROM public_songs
                    JOIN users ON users.id = public_songs.user_id
                    ORDER BY public_songs.published_at DESC, users.username COLLATE NOCASE
                    """
                ).fetchall()
            songs = []
            for row in rows:
                song = json.loads(row["song_json"])
                song["sharedBy"] = row["username"]
                song["publishedAt"] = row["published_at"]
                songs.append(song)
            self.send_json(200, {"songs": songs})
            return
        if self.path.startswith("/api/"):
            self.send_json(404, {"error": "API endpoint not found."})
            return
        super().do_GET()

    def do_POST(self):
        if not self.path.startswith("/api/"):
            self.send_json(404, {"error": "Endpoint not found."})
            return
        if not self.check_same_origin():
            self.send_json(403, {"error": "Cross-origin request rejected."})
            return
        try:
            payload = self.read_json()
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return
        if not isinstance(payload, dict):
            self.send_json(400, {"error": "Invalid request."})
            return
        if self.path == "/api/register":
            self.register(payload)
        elif self.path == "/api/login":
            self.login(payload)
        elif self.path == "/api/recover":
            self.recover_account(payload)
        elif self.path == "/api/logout":
            self.logout()
        elif self.path == "/api/song-sharing":
            self.set_song_sharing(payload)
        elif self.path == "/api/recovery-key":
            self.generate_recovery_key()
        else:
            self.send_json(404, {"error": "API endpoint not found."})

    def check_login_rate_limit(self, username):
        attempt_key = (self.client_address[0], username.casefold())
        now = int(time.time())
        with self.server.login_attempts_lock:
            recent_attempts = [
                attempt
                for attempt in self.server.login_attempts.get(attempt_key, [])
                if now - attempt < 900
            ]
            if len(recent_attempts) >= 10:
                retry_after = max(1, 900 - (now - recent_attempts[0]))
                self.server.login_attempts[attempt_key] = recent_attempts
            else:
                retry_after = None
                self.server.login_attempts[attempt_key] = recent_attempts + [now]
        return attempt_key, retry_after

    def clear_login_attempts(self, attempt_key):
        with self.server.login_attempts_lock:
            self.server.login_attempts.pop(attempt_key, None)

    def send_rate_limit_error(self, retry_after):
        self.send_json(
            429,
            {"error": "Too many sign-in attempts. Try again in a few minutes."},
            {"Retry-After": str(retry_after)},
        )

    def generate_recovery_key(self):
        with connect_database() as connection:
            user = self.get_user(connection)
            if user is None:
                self.send_json(401, {"error": "Please sign in again."})
                return
            recovery_key = secrets.token_urlsafe(32)
            connection.execute(
                """
                INSERT INTO recovery_keys(user_id, key_hash, created_at)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    key_hash = excluded.key_hash,
                    created_at = excluded.created_at
                """,
                (
                    user["id"],
                    hashlib.sha256(recovery_key.encode("utf-8")).digest(),
                    int(time.time()),
                ),
            )
        self.send_json(200, {"recoveryKey": recovery_key})

    def set_song_sharing(self, payload):
        song_id = payload.get("songId")
        is_public = payload.get("isPublic")
        if not isinstance(song_id, str) or not song_id or len(song_id) > 128 or type(is_public) is not bool:
            self.send_json(400, {"error": "Invalid song-sharing request."})
            return
        with connect_database() as connection:
            user = self.get_user(connection)
            if user is None:
                self.send_json(401, {"error": "Please sign in again."})
                return
            library = connection.execute(
                "SELECT songs_json FROM song_libraries WHERE user_id = ?",
                (user["id"],),
            ).fetchone()
            song = next(
                (
                    item for item in json.loads(library["songs_json"])
                    if item.get("id") == song_id
                ),
                None,
            ) if library else None
            if song is None:
                self.send_json(404, {"error": "That song is not in your library."})
                return
            if is_public:
                connection.execute(
                    """
                    INSERT INTO public_songs(user_id, song_id, song_json, published_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(user_id, song_id) DO UPDATE SET
                        song_json = excluded.song_json,
                        published_at = excluded.published_at
                    """,
                    (user["id"], song_id, json.dumps(song, separators=(",", ":")), int(time.time())),
                )
            else:
                connection.execute(
                    "DELETE FROM public_songs WHERE user_id = ? AND song_id = ?",
                    (user["id"], song_id),
                )
        self.send_json(200, {"ok": True, "isPublic": is_public})

    def register(self, payload):
        username = payload.get("username")
        password = payload.get("password")
        if not isinstance(username, str) or not USERNAME_PATTERN.fullmatch(username):
            self.send_json(
                400,
                {"error": "Username must be 3–24 characters: letters, numbers, _ or -."},
            )
            return
        if not isinstance(password, str) or len(password) < 10 or len(password) > 1024:
            self.send_json(400, {"error": "Password must be at least 10 characters."})
            return
        salt = secrets.token_bytes(16)
        password_hash = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
        )
        try:
            with connect_database() as connection:
                cursor = connection.execute(
                    """
                    INSERT INTO users(username, password_hash, password_salt, created_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (username, password_hash, salt, int(time.time())),
                )
                user_id = cursor.lastrowid
                connection.execute(
                    "INSERT INTO song_libraries(user_id, songs_json, updated_at) VALUES (?, '[]', ?)",
                    (user_id, int(time.time())),
                )
                token = self.create_session(connection, user_id)
        except sqlite3.IntegrityError:
            self.send_json(409, {"error": "That username is already taken."})
            return
        self.send_json(
            201,
            {"user": {"username": username}},
            self.set_session_cookie(token),
        )

    def login(self, payload):
        username = payload.get("username")
        password = payload.get("password")
        if (
            not isinstance(username, str)
            or len(username) > 24
            or not isinstance(password, str)
            or not password
            or len(password) > 1024
        ):
            self.send_json(400, {"error": "Enter your username and password."})
            return
        attempt_key, retry_after = self.check_login_rate_limit(username)
        if retry_after is not None:
            self.send_rate_limit_error(retry_after)
            return
        with connect_database() as connection:
            user = connection.execute(
                "SELECT id, username, password_hash, password_salt FROM users WHERE username = ? COLLATE NOCASE",
                (username,),
            ).fetchone()
            salt = user["password_salt"] if user else bytes(16)
            expected_hash = user["password_hash"] if user else bytes(32)
            actual_hash = hashlib.pbkdf2_hmac(
                "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
            )
            if user is None or not hmac.compare_digest(actual_hash, expected_hash):
                self.send_json(401, {"error": "Username or password is incorrect."})
                return
            token = self.create_session(connection, user["id"])
        self.clear_login_attempts(attempt_key)
        self.send_json(
            200,
            {"user": {"username": user["username"]}},
            self.set_session_cookie(token),
        )

    def recover_account(self, payload):
        username = payload.get("username")
        recovery_key = payload.get("recoveryKey")
        if (
            not isinstance(username, str)
            or not USERNAME_PATTERN.fullmatch(username)
            or not isinstance(recovery_key, str)
            or not 32 <= len(recovery_key) <= 128
        ):
            self.send_json(400, {"error": "Upload a valid Nightshift recovery-key file."})
            return
        attempt_key, retry_after = self.check_login_rate_limit(username)
        if retry_after is not None:
            self.send_rate_limit_error(retry_after)
            return
        supplied_hash = hashlib.sha256(recovery_key.encode("utf-8")).digest()
        with connect_database() as connection:
            user = connection.execute(
                """
                SELECT users.id, users.username, recovery_keys.key_hash
                FROM users LEFT JOIN recovery_keys ON recovery_keys.user_id = users.id
                WHERE users.username = ? COLLATE NOCASE
                """,
                (username,),
            ).fetchone()
            expected_hash = user["key_hash"] if user and user["key_hash"] else bytes(32)
            if user is None or not hmac.compare_digest(supplied_hash, expected_hash):
                self.send_json(401, {"error": "Recovery key is invalid. Check the file and try again."})
                return
            token = self.create_session(connection, user["id"])
        self.clear_login_attempts(attempt_key)
        self.send_json(
            200,
            {"user": {"username": user["username"]}},
            self.set_session_cookie(token),
        )

    def logout(self):
        with connect_database() as connection:
            user = self.get_user(connection)
            if user is not None:
                cookies = SimpleCookie(self.headers.get("Cookie", ""))
                token = cookies["nightshift_session"].value
                token_hash = hashlib.sha256(token.encode("utf-8")).digest()
                connection.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
        self.send_json(200, {"ok": True}, self.clear_session_cookie())

    def do_PUT(self):
        if self.path != "/api/songs":
            self.send_json(404, {"error": "API endpoint not found."})
            return
        if not self.check_same_origin():
            self.send_json(403, {"error": "Cross-origin request rejected."})
            return
        try:
            payload = self.read_json()
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return
        songs = payload.get("songs") if isinstance(payload, dict) else None
        if not isinstance(songs, list) or len(songs) > 500:
            self.send_json(400, {"error": "Invalid song library."})
            return
        if any(not isinstance(song, dict) or not isinstance(song.get("id"), str) for song in songs):
            self.send_json(400, {"error": "Every saved song must have an id."})
            return
        songs_json = json.dumps(songs, separators=(",", ":"))
        with connect_database() as connection:
            user = self.get_user(connection)
            if user is None:
                self.send_json(401, {"error": "Please sign in again."})
                return
            connection.execute(
                """
                INSERT INTO song_libraries(user_id, songs_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    songs_json = excluded.songs_json,
                    updated_at = excluded.updated_at
                """,
                (user["id"], songs_json, int(time.time())),
            )
            library_by_id = {song["id"]: song for song in songs}
            published_rows = connection.execute(
                "SELECT song_id FROM public_songs WHERE user_id = ?",
                (user["id"],),
            ).fetchall()
            for row in published_rows:
                published_song = library_by_id.get(row["song_id"])
                if published_song is None:
                    connection.execute(
                        "DELETE FROM public_songs WHERE user_id = ? AND song_id = ?",
                        (user["id"], row["song_id"]),
                    )
                else:
                    connection.execute(
                        "UPDATE public_songs SET song_json = ? WHERE user_id = ? AND song_id = ?",
                        (json.dumps(published_song, separators=(",", ":")), user["id"], row["song_id"]),
                    )
        self.send_json(200, {"ok": True})

    def do_HEAD(self):
        if not (DIST / "index.html").is_file():
            self.send_json(503, {"error": "Build the frontend first with npm run build."})
            return
        super().do_HEAD()

    def do_OPTIONS(self):
        self.send_json(405, {"error": "Method not allowed."})

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description="Run the Nightshift Studio web app and account API.")
    parser.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8000")))
    args = parser.parse_args()
    initialize_database()
    server = ThreadingHTTPServer((args.host, args.port), StudioHandler)
    server.login_attempts = {}
    server.login_attempts_lock = threading.Lock()
    print(f"Nightshift Studio listening on http://{args.host}:{args.port}")
    if not COOKIE_SECURE:
        print("Warning: session cookies are not Secure. Use HTTPS and NIGHTSHIFT_COOKIE_SECURE=1 in production.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Nightshift Studio.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
