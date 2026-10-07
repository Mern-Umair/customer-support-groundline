import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 text-zinc-900">
      <header className="mx-auto w-full max-w-5xl px-6 py-5">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Groundline
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-24">
        {children}
      </main>
    </div>
  );
}
