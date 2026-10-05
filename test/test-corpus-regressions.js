import assert from "node:assert/strict"
import {parser} from "../dist/index.js"

function accepts(name, source, ...nodes) {
  it(name, () => {
    const tree = parser.configure({strict: true}).parse(source)
    for (const node of nodes) assert.ok(tree.toString().includes(node), `Missing ${node}: ${tree}`)
  })
}

describe("upstream corpus regressions", () => {
  accepts("unnamed and nested function type parameters", `
    external get: (array<'a>, int) => 'a = "%array_unsafe_get"
    external map: (array<'a>, 'a => 'b, ~start: int=?) => array<'b> = "map"
    type cmp<'a> = ('a, 'a) => int
  `, "FunctionType")
  accepts("abstract implementation types", `type arrayLike<'a>\ntype t\nlet x = 1`, "TypeDeclaration")
})
