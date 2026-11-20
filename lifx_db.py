"""SQLite storage for the LIFX controller: app data, user accounts and login sessions.

Standard library only. The database file is lifx.db beside hl_lifx_control.py."""
import hashlib, json, sqlite3, threading, time

LIST_KEYS = ('groups', 'schedules', 'rooms', 'scenes', 'favorites')
DATA_KEYS = ('settings',) + LIST_KEYS

SCHEMA = """
CREATE TABLE IF NOT EXISTS app_data (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    theme TEXT NOT NULL,
    accent TEXT NOT NULL,
    contrast TEXT NOT NULL DEFAULT 'standard',
    text_size TEXT NOT NULL DEFAULT 'default',
    motion TEXT NOT NULL DEFAULT 'system',
    password TEXT NOT NULL,
    pin TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
"""

UPSERT_DATA = ('INSERT INTO app_data (key, value) VALUES (?, ?) '
               'ON CONFLICT(key) DO UPDATE SET value = excluded.value')
UPSERT_USER = ('INSERT INTO users (id, username, name, theme, accent, contrast, text_size, motion, password, pin) '
               'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) '
               'ON CONFLICT(id) DO UPDATE SET name = excluded.name, theme = excluded.theme, '
               'accent = excluded.accent, contrast = excluded.contrast, text_size = excluded.text_size, '
               'motion = excluded.motion, password = excluded.password, pin = excluded.pin')

USER_MIGRATIONS = {
    'contrast': "TEXT NOT NULL DEFAULT 'standard'",
    'text_size': "TEXT NOT NULL DEFAULT 'default'",
    'motion': "TEXT NOT NULL DEFAULT 'system'",
}


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def _user(row):
    if row is None:
        return None
    return {'id': row['id'], 'username': row['username'], 'name': row['name'], 'theme': row['theme'],
            'accent': row['accent'], 'contrast': row['contrast'], 'textSize': row['text_size'],
            'motion': row['motion'], 'password': json.loads(row['password']),
            'pin': json.loads(row['pin']) if row['pin'] else None}


def _user_values(u):
    return (u['id'], u['username'], u['name'], u.get('theme', 'auto'), u.get('accent', 'blue'),
            u.get('contrast', 'standard'), u.get('textSize', 'default'), u.get('motion', 'system'),
            json.dumps(u['password']), json.dumps(u['pin']) if u.get('pin') else None)


class Store:
    def __init__(self, path):
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute('PRAGMA foreign_keys = ON')
        self.conn.executescript(SCHEMA)
        have = {row['name'] for row in self.conn.execute('PRAGMA table_info(users)')}
        for column, decl in USER_MIGRATIONS.items():
            if column not in have:
                self.conn.execute(f'ALTER TABLE users ADD COLUMN {column} {decl}')
        self.conn.commit()
        self.lock = threading.RLock()

    def has_app_data(self):
        with self.lock:
            return self.conn.execute('SELECT 1 FROM app_data LIMIT 1').fetchone() is not None

    def get_data(self, key, default):
        with self.lock:
            row = self.conn.execute('SELECT value FROM app_data WHERE key = ?', (key,)).fetchone()
        return json.loads(row['value']) if row else default

    def save_data(self, values):
        with self.lock, self.conn:
            self._write_data(values)

    def _write_data(self, values):
        self.conn.executemany(UPSERT_DATA, [(k, json.dumps(v)) for k, v in values.items()])

    def user_count(self):
        with self.lock:
            return self.conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]

    def user_by_name(self, name):
        with self.lock:
            return _user(self.conn.execute('SELECT * FROM users WHERE username = ?', (name,)).fetchone())

    def insert_user(self, u):
        with self.lock, self.conn:
            self.conn.execute(UPSERT_USER, _user_values(u))

    def update_user(self, u):
        with self.lock, self.conn:
            self.conn.execute(UPSERT_USER, _user_values(u))

    def create_session(self, token, user_id, expires):
        with self.lock, self.conn:
            self.conn.execute('DELETE FROM sessions WHERE expires <= ?', (time.time(),))
            self.conn.execute('INSERT INTO sessions (token_hash, user_id, expires) VALUES (?, ?, ?)',
                              (token_hash(token), user_id, expires))

    def session_user(self, token):
        if not token:
            return None
        with self.lock:
            row = self.conn.execute('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id '
                                    'WHERE s.token_hash = ? AND s.expires > ?',
                                    (token_hash(token), time.time())).fetchone()
        return _user(row)

    def delete_session(self, token):
        if not token:
            return
        with self.lock, self.conn:
            self.conn.execute('DELETE FROM sessions WHERE token_hash = ?', (token_hash(token),))

    def delete_other_sessions(self, user_id, keep_token):
        with self.lock, self.conn:
            self.conn.execute('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?',
                              (user_id, token_hash(keep_token or '')))

    def import_legacy(self, data):
        """Copy accounts and app data from the older config.json format in one transaction."""
        with self.lock, self.conn:
            for u in data.get('users', []):
                u.setdefault('name', u['username'])
                self.conn.execute(UPSERT_USER, _user_values(u))
            self._write_data({k: data[k] for k in DATA_KEYS if k in data})
