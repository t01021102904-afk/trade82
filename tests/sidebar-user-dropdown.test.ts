import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8")
}

test("sidebar user menu no longer uses Base UI dropdown components", () => {
  const navUser = source("src/components/nav-user.tsx")

  assert.doesNotMatch(navUser, /components\/ui\/dropdown-menu/)
  assert.doesNotMatch(navUser, /DropdownMenu/)
  assert.match(navUser, /createPortal/)
  assert.match(navUser, /aria-haspopup="menu"/)
  assert.match(navUser, /role="menu"/)
  assert.match(navUser, /role="menuitem"/)
})

test("sidebar user menu opens locally and supports all actions", () => {
  const navUser = source("src/components/nav-user.tsx")
  const sidebar = source("src/components/app-sidebar.tsx")

  assert.match(navUser, /setOpen\(\(current\) => !current\)/)
  assert.match(navUser, /const navigate = \(url: string\)/)
  assert.match(navUser, /router\.push\(url\)/)
  assert.match(navUser, /navigate\(companyProfileUrl\)/)
  assert.match(navUser, /navigate\(settingsUrl\)/)
  assert.match(navUser, /navigate\(helpUrl\)/)
  assert.match(navUser, /signOut/)
  assert.match(sidebar, /helpUrl=\{href\("\/how-it-works"\)\}/)
})

test("sidebar menu is rendered outside the sidebar clipping context", () => {
  const navUser = source("src/components/nav-user.tsx")

  assert.match(navUser, /document\.body/)
  assert.match(navUser, /className="fixed z-\[100\]/)
  assert.match(navUser, /getBoundingClientRect/)
  assert.match(navUser, /window\.addEventListener\("resize"/)
  assert.match(navUser, /window\.addEventListener\("scroll"/)
})

test("sidebar user menu uses semantic shadcn color tokens", () => {
  const navUser = source("src/components/nav-user.tsx")

  assert.match(navUser, /border-border/)
  assert.match(navUser, /bg-popover/)
  assert.match(navUser, /text-popover-foreground/)
  assert.match(navUser, /hover:bg-accent/)
  assert.match(navUser, /focus-visible:ring-ring/)
  assert.doesNotMatch(
    navUser,
    /theme-|bm-|#34B386|#34b386|emerald-|green-|zinc-|slate-/,
  )
})
