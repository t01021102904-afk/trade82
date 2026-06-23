import { ProductCardSkeleton } from "@/components/product-card";

export default function MarketplaceLoading() {
  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-3">
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
          <div className="h-9 w-72 max-w-full animate-pulse rounded bg-zinc-200" />
          <div className="h-5 w-full max-w-2xl animate-pulse rounded bg-zinc-100" />
        </div>
        <div className="h-12 animate-pulse rounded-md bg-zinc-200" />
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
