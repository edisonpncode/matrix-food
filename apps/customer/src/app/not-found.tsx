import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <p className="mt-4 text-xl font-semibold">Página não encontrada</p>
      <p className="mt-2 text-center text-muted-foreground">
        A página que você procura não existe ou foi removida.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
