const Database = require('better-sqlite3');
const db = new Database(process.env.DB_FILE || require('path').join(__dirname, 'inventory.db'));
db.pragma('foreign_keys = ON');

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}
function addColumn(table, column, definition) {
  if (!hasColumn(table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

// Existing database is preserved. Its current 3,489-product master becomes Shivaay International's master.
db.exec(`
CREATE TABLE IF NOT EXISTS companies (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL UNIQUE,
 code TEXT NOT NULL UNIQUE,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);
const existingCompany = db.prepare('SELECT id FROM companies ORDER BY id LIMIT 1').get();
let shivaayId;
if (!existingCompany) {
  shivaayId = Number(db.prepare('INSERT INTO companies(name,code) VALUES(?,?)').run('Shivaay International Pvt. Ltd.', 'SHIV').lastInsertRowid);
} else shivaayId = existingCompany.id;

// Safe migrations for the supplied legacy schema.
addColumn('products', 'company_id', `INTEGER NOT NULL DEFAULT ${shivaayId}`);
addColumn('products', 'is_rx', 'INTEGER NOT NULL DEFAULT 0');
addColumn('products', 'active', 'INTEGER NOT NULL DEFAULT 1');
addColumn('purchases', 'company_id', `INTEGER NOT NULL DEFAULT ${shivaayId}`);
addColumn('orders', 'company_id', `INTEGER NOT NULL DEFAULT ${shivaayId}`);
addColumn('orders', 'party_id', 'INTEGER');
addColumn('orders', 'bill_number', 'TEXT');
addColumn('orders', 'bill_date', 'TEXT');
addColumn('orders', 'order_type', `TEXT NOT NULL DEFAULT 'FSV'`);

// Core business tables.
db.exec(`
CREATE TABLE IF NOT EXISTS parties (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 type TEXT NOT NULL DEFAULT 'Customer' CHECK(type IN ('Customer','Supplier','Both')),
 phone TEXT, address TEXT, email TEXT, opening_balance REAL NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(company_id,name)
);
CREATE TABLE IF NOT EXISTS sales_returns (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 return_number TEXT NOT NULL,
 bill_number TEXT, party_id INTEGER REFERENCES parties(id), product_id INTEGER NOT NULL REFERENCES products(id),
 quantity REAL NOT NULL CHECK(quantity>0), unit_price REAL NOT NULL DEFAULT 0,
 return_date TEXT NOT NULL, credit_note_number TEXT,
 notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(company_id,return_number)
);
CREATE TABLE IF NOT EXISTS foc_issues (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 foc_number TEXT NOT NULL,
 party_id INTEGER REFERENCES parties(id), product_id INTEGER NOT NULL REFERENCES products(id),
 quantity REAL NOT NULL CHECK(quantity>0), issue_date TEXT NOT NULL, notes TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(company_id,foc_number)
);
CREATE TABLE IF NOT EXISTS credit_notes (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 credit_note_number TEXT NOT NULL, party_id INTEGER REFERENCES parties(id), bill_number TEXT,
 amount REAL NOT NULL DEFAULT 0, note_date TEXT NOT NULL, reason TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(company_id,credit_note_number)
);
CREATE TABLE IF NOT EXISTS payments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 party_id INTEGER REFERENCES parties(id),
 payment_type TEXT NOT NULL CHECK(payment_type IN ('Received','Paid')),
 amount REAL NOT NULL CHECK(amount>0), payment_date TEXT NOT NULL,
 bill_number TEXT, reference TEXT, notes TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 username TEXT NOT NULL,
 password TEXT NOT NULL,
 display_name TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'User' CHECK(role IN ('Super Admin','Admin','User')),
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(company_id,username)
);
CREATE TABLE IF NOT EXISTS user_permissions (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 module TEXT NOT NULL,
 allowed INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,module)
);
CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_company ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_purchases_company ON purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_returns_company ON sales_returns(company_id);
CREATE INDEX IF NOT EXISTS idx_foc_company ON foc_issues(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(company_id);
`);

// Seed admin only when no users exist.
if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  const info = db.prepare(`INSERT INTO users(company_id,username,password,display_name,role) VALUES(?,?,?,?,?)`)
    .run(shivaayId, 'admin', 'admin123', 'Admin', 'Super Admin');
  const modules = ['Dashboard','Sales','Purchases','Inventory','Customers','Suppliers','Financing','Payments','Ledger','Reports','Import / Export','Users & Roles','Settings'];
  const ins = db.prepare('INSERT INTO user_permissions(user_id,module,allowed) VALUES(?,?,1)');
  db.transaction(() => modules.forEach(m => ins.run(info.lastInsertRowid, m)))();
}

const stockSql = `(p.opening_stock + COALESCE((SELECT SUM(quantity) FROM purchases pu WHERE pu.product_id=p.id AND pu.company_id=p.company_id),0) + COALESCE((SELECT SUM(quantity) FROM sales_returns sr WHERE sr.product_id=p.id AND sr.company_id=p.company_id),0) - COALESCE((SELECT SUM(quantity) FROM orders o WHERE o.product_id=p.id AND o.company_id=p.company_id AND o.status <> 'Cancelled' AND COALESCE(p.is_rx,0)=0),0) - COALESCE((SELECT SUM(quantity) FROM foc_issues fi WHERE fi.product_id=p.id AND fi.company_id=p.company_id),0))`;
function product(id, companyId) {
  return db.prepare(`SELECT p.*, ${stockSql} current_stock,
    COALESCE((SELECT SUM(quantity) FROM purchases pu WHERE pu.product_id=p.id AND pu.company_id=p.company_id),0) purchased,
    COALESCE((SELECT SUM(quantity) FROM orders o WHERE o.product_id=p.id AND o.company_id=p.company_id AND o.status <> 'Cancelled'),0) sold,
    COALESCE((SELECT SUM(quantity) FROM sales_returns sr WHERE sr.product_id=p.id AND sr.company_id=p.company_id),0) returned,
    COALESCE((SELECT SUM(quantity) FROM foc_issues fi WHERE fi.product_id=p.id AND fi.company_id=p.company_id),0) foc
    FROM products p WHERE p.id=? AND p.company_id=?`).get(id, companyId);
}
function products(companyId) {
  return db.prepare(`SELECT p.*, ${stockSql} current_stock,
    COALESCE((SELECT SUM(quantity) FROM purchases pu WHERE pu.product_id=p.id AND pu.company_id=p.company_id),0) purchased,
    COALESCE((SELECT SUM(quantity) FROM orders o WHERE o.product_id=p.id AND o.company_id=p.company_id AND o.status <> 'Cancelled'),0) sold,
    COALESCE((SELECT SUM(quantity) FROM sales_returns sr WHERE sr.product_id=p.id AND sr.company_id=p.company_id),0) returned,
    COALESCE((SELECT SUM(quantity) FROM foc_issues fi WHERE fi.product_id=p.id AND fi.company_id=p.company_id),0) foc
    FROM products p WHERE p.company_id=? AND p.active=1 ORDER BY p.brand,p.name`).all(companyId);
}
function assertStock(id, companyId, extra=0) {
  const p=product(id,companyId); if(!p) throw Error('Product not found.');
  if (p.current_stock + extra < -1e-9) throw Error(`Insufficient stock for ${p.brand} — ${p.name}. Available: ${p.current_stock}.`);
}
function orderWithProduct(id, companyId) { return db.prepare(`SELECT o.*,p.brand,p.name product_name,p.is_rx FROM orders o JOIN products p ON p.id=o.product_id WHERE o.id=? AND o.company_id=?`).get(id,companyId); }
function purchaseWithProduct(id, companyId) { return db.prepare(`SELECT pu.*,p.brand,p.name product_name FROM purchases pu JOIN products p ON p.id=pu.product_id WHERE pu.id=? AND pu.company_id=?`).get(id,companyId); }
module.exports={db,shivaayId,product,products,assertStock,orderWithProduct,purchaseWithProduct,stockSql};
