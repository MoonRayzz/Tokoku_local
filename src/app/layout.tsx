// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { AutoSyncWorker } from "@/components/features/AutoSyncWorker";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";
import prisma from "@/lib/db";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TokoKu POS - Offline First",
  description: "Sistem Kasir Lokal secepat kilat dengan sinkronisasi background Supabase.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Query langsung ke SQLite lokal menggunakan Prisma
  // Memeriksa tabel SyncQueue yang sebelumnya kita buat di schema.prisma
  let pendingSyncCount = 0;
  try {
    pendingSyncCount = await prisma.syncQueue.count({
      where: { status: 'PENDING' }
    });
  } catch (error) {
    console.error("Gagal membaca SyncQueue SQLite:", error);
  }

  return (
    <html lang="id" className="dark">
      <head>
        {/* Font Eksternal sesuai Mockup Anda */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.className} bg-background text-text-primary overflow-hidden flex h-screen w-screen selection:bg-primary-container selection:text-on-primary-container`}>
        <ToastProvider>
          <ConfirmDialogProvider>

            {/* PEKERJA BAYANGAN: Aktif mendengarkan internet dan otomatis mengirim data tertunda */}
            <AutoSyncWorker />

            {/* Komponen Navigasi Utama */}
            <Sidebar />

            {/* Pembungkus Halaman */}
            <div className="flex-1 flex flex-col ml-sidebar-collapsed h-screen overflow-hidden">
              {/* Topbar diisi angka aktual dari Database lokal */}
              <TopBar pendingSyncCount={pendingSyncCount} />
              
              {/* Area Konten Utama */}
              <main className="flex-1 mt-16 overflow-y-auto bg-background">
                {children}
              </main>
            </div>

          </ConfirmDialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}