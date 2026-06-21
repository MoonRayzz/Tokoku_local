export default function Loading() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-background min-h-[50vh]">
      <div className="flex flex-col items-center gap-4">
        <span className="material-symbols-outlined text-primary-container text-4xl animate-spin">
          progress_activity
        </span>
        <p className="text-text-secondary text-sm font-medium animate-pulse">
          Memuat data...
        </p>
      </div>
    </div>
  );
}
