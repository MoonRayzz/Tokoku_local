export const PAGE_SIZE = {
  TRANSAKSI: 20,    // laporan transaksi
  PRODUK: 24,       // grid produk (kelipatan 3 atau 4 untuk layout grid)
  MEMBER: 25,       // tabel member
  STOK_LOG: 30,     // log stok
  PENGELUARAN: 20,  // pengeluaran
  ABSENSI: 20,      // absensi
  DEFAULT: 20,
} as const;
