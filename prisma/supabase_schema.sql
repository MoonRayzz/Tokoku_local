-- ============================================================
-- JALANKAN SCRIPT INI DI SUPABASE SQL EDITOR
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run
-- ============================================================

-- 1. Tabel Produk
CREATE TABLE IF NOT EXISTS "public"."Product" (
  "id"               TEXT        NOT NULL,
  "sku"              TEXT        NOT NULL,
  "name"             TEXT        NOT NULL,
  "priceRetail"      FLOAT8      NOT NULL,
  "priceWholesale"   FLOAT8,
  "wholesaleMinQty"  INT4        DEFAULT 0,
  "stock"            INT4        NOT NULL DEFAULT 0,
  "minStockAlert"    INT4        NOT NULL DEFAULT 5,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Product_sku_key" ON "public"."Product"("sku");

-- 2. Tabel Member
CREATE TABLE IF NOT EXISTS "public"."Member" (
  "id"       TEXT        NOT NULL,
  "phone"    TEXT        NOT NULL,
  "name"     TEXT        NOT NULL,
  "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Member_phone_key" ON "public"."Member"("phone");

-- 3. Tabel Transaksi (Header Struk)
CREATE TABLE IF NOT EXISTS "public"."Transaction" (
  "id"            TEXT        NOT NULL,
  "receiptNumber" TEXT        NOT NULL,
  "memberId"      TEXT,           -- Sengaja tanpa FK ke Member (sync parsial)
  "totalAmount"   FLOAT8      NOT NULL,
  "cashReceived"  FLOAT8      NOT NULL,
  "change"        FLOAT8      NOT NULL,
  "isVoid"        BOOLEAN     NOT NULL DEFAULT FALSE,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_receiptNumber_key" ON "public"."Transaction"("receiptNumber");

-- 4. Tabel Detail Item per Transaksi
CREATE TABLE IF NOT EXISTS "public"."TransactionDetail" (
  "id"            TEXT   NOT NULL,
  "transactionId" TEXT   NOT NULL,
  "productId"     TEXT   NOT NULL,  -- Sengaja tanpa FK ke Product (sync parsial)
  "quantity"      INT4   NOT NULL,
  "priceAtTime"   FLOAT8 NOT NULL,
  "subtotal"      FLOAT8 NOT NULL,
  CONSTRAINT "TransactionDetail_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TransactionDetail_transactionId_fkey" FOREIGN KEY ("transactionId")
    REFERENCES "public"."Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================================
-- SELESAI. Refresh halaman Tables di Supabase untuk melihat hasilnya.
-- ============================================================
