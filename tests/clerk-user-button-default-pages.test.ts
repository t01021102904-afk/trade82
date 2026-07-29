import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8")
}

test("Clerk profile keeps only Clerk default account pages", () => {
  const userButton = source("src/components/clerk-user-button.tsx")

  assert.match(userButton, /import \{ UserButton \} from "@clerk\/nextjs"/)
  assert.match(userButton, /return <UserButton \/>/)
  assert.doesNotMatch(userButton, /UserProfilePage/)
  assert.doesNotMatch(userButton, /Professional Info/)
  assert.doesNotMatch(userButton, /My Company/)
  assert.doesNotMatch(userButton, /My Products/)
  assert.doesNotMatch(userButton, /ContactProfileSettings/)
  assert.doesNotMatch(userButton, /CompanyProfileSettings/)
  assert.doesNotMatch(userButton, /ProductManagement/)
  assert.doesNotMatch(userButton, /canManageProducts/)
})
