import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-[520px] max-w-3xl content-center px-4 py-16 text-center sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-blue-700">404</p>
      <h1 className="mt-3 text-2xl font-semibold text-zinc-950">Page not found</h1>
      <p className="mt-3 text-zinc-600">
        The marketplace profile you are looking for is not available.
      </p>
      <Link
        href="/marketplace"
        className="mx-auto mt-6 inline-flex rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Back to marketplace
      </Link>
    </div>
  );
}
