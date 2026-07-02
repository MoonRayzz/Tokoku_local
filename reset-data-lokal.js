/**
 * reset-data-lokal.js
 * Script untuk mengosongkan data uji coba di SQLite lokal (app-toko-lokal)
 * Menggunakan better-sqlite3 langsung (tidak perlu Prisma engine)
 *
 * Cara pakai:
 *   node reset-data-lokal.js              → hapus transaksi saja (aman)
 *   node reset-data-lokal.js --full       → reset SEMUA (termasuk produk & master data)
 *
 * ⚠️  StoreProfile dan StoreStatus TIDAK akan dihapus (setting toko tetap aman)
 */

const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "dev.db");
const db = new Database(DB_PATH);
const isFullReset = process.argv.includes("--full");

// Aktifkan foreign keys
db.pragma("foreign_keys = OFF"); // Matikan dulu supaya delete urut bisa bebas

function deleteTable(tableName) {
  const result = db.prepare(`DELETE FROM "${tableName}"`).run();
  console.log(`  ✓ ${tableName} dihapus: ${result.changes} baris`);
}

function resetTransaksiSaja() {
  console.log("🔄 Mode: Hapus transaksi & data operasional saja...\n");

  // Urutan aman (meski FK off, tetap rapi)
  deleteTable("SalaryPayout");
  deleteTable("Attendance");
  deleteTable("DebtPayment");
  deleteTable("Debt");
  deleteTable("VoidLog");
  deleteTable("TransactionDetail");
  deleteTable("Transaction");
  deleteTable("StockLog");
  deleteTable("PoItem");
  deleteTable("PurchaseOrder");
  deleteTable("CashRegisterReport");
  deleteTable("Expense");
  deleteTable("SyncQueue");

  console.log("\n✅ Data transaksi & operasional berhasil dihapus.");
  console.log("   Produk, Karyawan, Member, Shift tetap ada.");
}

function resetSemua() {
  console.log("🔄 Mode: FULL RESET — semua data akan dihapus...\n");

  resetTransaksiSaja();

  console.log("\n  📦 Lanjut hapus master data...");

  deleteTable("Member");
  deleteTable("MemberTier");
  deleteTable("Product");
  deleteTable("Supplier");
  deleteTable("Employee");
  deleteTable("Shift");

  console.log("\n✅ FULL RESET selesai!");
  console.log("   StoreProfile & StoreStatus TIDAK dihapus (setting toko aman).");
}

function main() {
  console.log("=".repeat(50));
  console.log("  RESET DATA — App Toko Lokal (SQLite)");
  console.log("=".repeat(50));
  console.log(`  File DB: ${DB_PATH}\n`);

  try {
    if (isFullReset) {
      resetSemua();
    } else {
      resetTransaksiSaja();
    }

    // Jalankan VACUUM untuk kompres file DB setelah hapus banyak data
    console.log("\n  🗜️  Kompres database (VACUUM)...");
    db.prepare("VACUUM").run();
    console.log("  ✓ Database dikompresi.");
  } catch (error) {
    console.error("\n❌ Error saat reset:", error.message);
    process.exit(1);
  } finally {
    db.pragma("foreign_keys = ON");
    db.close();
  }
}

main();
