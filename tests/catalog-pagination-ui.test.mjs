import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

function source(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8")
}

test("shadcn pagination primitives are installed", () => {
  const base = source("src/components/ui/pagination.tsx")

  for (const name of [
    "Pagination",
    "PaginationContent",
    "PaginationEllipsis",
    "PaginationItem",
    "PaginationLink",
    "PaginationNext",
    "PaginationPrevious",
  ]) {
    assert.match(base, new RegExp(`\\b${name}\\b`))
  }

  assert.match(base, /buttonVariants/)
  assert.match(base, /isActive \? "outline" : "ghost"/)
})

test("shared catalog controls use the exact shadcn composition", () => {
  const controls = source(
    "src/components/pagination-controls.tsx",
  )

  assert.match(controls, /<Pagination className="mt-8">/)
  assert.match(controls, /<PaginationContent>/)
  assert.match(controls, /<PaginationPrevious/)
  assert.match(controls, /<PaginationLink/)
  assert.match(controls, /isActive=\{entry === safePage\}/)
  assert.match(controls, /<PaginationEllipsis/)
  assert.match(controls, /<PaginationNext/)
  assert.match(controls, /onPageChange\(targetPage\)/)
  assert.doesNotMatch(
    controls,
    /theme-|bm-|#34B386|#34b386|emerald-|green-|zinc-|slate-/,
  )
})

test("Marketplace and Sellers still use the untouched shared component", () => {
  const marketplace = source(
    "src/components/marketplace-client.tsx",
  )
  const sellers = source("src/components/sellers-client.tsx")

  assert.match(
    marketplace,
    /import \{ PaginationControls \} from "@\/components\/pagination-controls"/,
  )
  assert.match(marketplace, /<PaginationControls/)
  assert.match(marketplace, /ProductCard/)

  assert.match(
    sellers,
    /import \{ PaginationControls \} from "@\/components\/pagination-controls"/,
  )
  assert.match(sellers, /<PaginationControls/)
  assert.match(sellers, /CountryFilterSelect/)
  assert.match(sellers, /SellerCard/)
})
