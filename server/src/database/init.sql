CREATE TABLE IF NOT EXISTS manufacturers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    logo TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    logo TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS creations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    workshop_link TEXT NOT NULL,
    manufacturer_id INTEGER,
    operator_id INTEGER,
    type INTEGER NOT NULL,
    usage INTEGER NOT NULL,
    creation_date INTEGER NOT NULL,
    status INTEGER NOT NULL,
    last_update INTEGER NOT NULL,
    FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id) ON DELETE RESTRICT,
    FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS microcontrollers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    workshop_link TEXT UNIQUE,
    creation_date INTEGER NOT NULL,
    status INTEGER NOT NULL,
    last_update INTEGER NOT NULL
);