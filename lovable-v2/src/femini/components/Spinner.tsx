export function Spinner() {
  return (
    <div className="grid gap-4" role="status" aria-label="جاري التحميل">
      <div className="h-9 w-56 animate-pulse rounded-xl bg-lav" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-lav" />)}</div>
      <div className="h-72 animate-pulse rounded-2xl bg-lav" />
    </div>
  );
}
