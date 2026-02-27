import Database from "better-sqlite3";
import { app } from "electron";
import { join } from "path";
import fs from "fs";

let db;

function getDb() {
    if (!db) {
        // Determine the base data path relative to the executable for self-contained behavior
        // If packaged, go up from the resources folder/app path to find the install root
        let baseDataPath;
        if (app.isPackaged) {
            // Usually: [InstallDir]\resources\app.asar
            // We want: [InstallDir]\data
            baseDataPath = join(app.getAppPath(), "..", "..", "data");
        } else {
            // In dev mode, use current folder
            baseDataPath = join(process.cwd(), "data");
        }

        if (!fs.existsSync(baseDataPath)) {
            fs.mkdirSync(baseDataPath, { recursive: true });
        }

        const dbPath = join(baseDataPath, "fb-profile.db");
        db = new Database(dbPath);

        db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT UNIQUE,
        password TEXT,
        two_fa TEXT,
        cookies TEXT,
        note TEXT,
        proxy_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS proxies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        host TEXT,
        port TEXT,
        username TEXT,
        password TEXT,
        type TEXT DEFAULT 'http',
        status TEXT DEFAULT 'unknown',
        last_check DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

        // Default settings
        const profilePath = db.prepare("SELECT value FROM settings WHERE key = 'profile_path'").get();
        if (!profilePath) {
            const defaultProfilesPath = join(baseDataPath, "profiles");
            db.prepare("INSERT INTO settings (key, value) VALUES ('profile_path', ?)").run(defaultProfilesPath);
            if (!fs.existsSync(defaultProfilesPath)) {
                fs.mkdirSync(defaultProfilesPath, { recursive: true });
            }
        }
    }
    return db;
}

export default {
    getDb,
    prepare: (...args) => getDb().prepare(...args),
    exec: (...args) => getDb().exec(...args),
    get: (sql, ...params) =>
        getDb()
            .prepare(sql)
            .get(...params),
    all: (sql, ...params) =>
        getDb()
            .prepare(sql)
            .all(...params),
    run: (sql, ...params) =>
        getDb()
            .prepare(sql)
            .run(...params),
};
