mod schema;

pub use schema::*;

use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &PathBuf) -> Result<Self> {
        let conn = Connection::open(path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_schema()?;
        db.run_migrations();
        Ok(db)
    }

    pub fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(SCHEMA)?;
        Ok(())
    }

    /// Run migrations for existing databases (ignores errors for already-applied migrations)
    fn run_migrations(&self) {
        let conn = self.conn.lock().unwrap();
        // Run each migration separately so one failure doesn't block others
        // SQLite will error if column already exists, which is fine
        for migration in MIGRATIONS_LIST {
            let _ = conn.execute(migration, []);
        }
    }

    /// Get the worktree path for a node
    pub fn get_node_worktree_path(&self, node_id: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT worktree_path FROM nodes WHERE id = ?")?;
        let result: Option<Option<String>> = stmt
            .query_row([node_id], |row| row.get(0))
            .ok();
        Ok(result.flatten())
    }
}

pub fn get_app_data_dir() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("caspian");
    std::fs::create_dir_all(&path).ok();
    path
}

pub fn get_db_path() -> PathBuf {
    let mut path = get_app_data_dir();
    path.push("caspian.db");
    path
}
