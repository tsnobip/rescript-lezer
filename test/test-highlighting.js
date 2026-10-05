import assert from "node:assert/strict"
import {TreeFragment} from "@lezer/common"
import {highlightTree, tags as t} from "@lezer/highlight"
import {parser} from "../dist/index.js"

function checkHighlighting(source, expected, tree = parser.parse(source)) {
  tree.iterate({enter(node) {
    assert.ok(!node.type.isError, `Parse error at ${node.from}-${node.to}: ${tree}`)
  }})

  const spans = []
  highlightTree(tree, {style(tags) {
    return tags.map(tag => tag.id).join(" ")
  }}, (from, to, classes) => spans.push({from, to, tags: classes.split(" ")}))

  for (const [text, tag, start = 0] of expected) {
    const from = source.indexOf(text, start)
    assert.ok(from >= 0, `Missing test token: ${text}`)
    assert.ok(spans.some(span => span.from <= from && span.to >= from + text.length &&
      span.tags.includes(String(tag.id))), `Wrong highlighting for ${text} at ${from}`)
  }
  return tree
}

describe("highlighting regressions", () => {
  it("parses and highlights exception declarations with inline record payloads", () => {
    const source = `exception HttpError({status: int})
let isRetriable: exn => bool = error =>
  switch error {
  | HttpError({status: 502 | 503 | 504}) => true
  | _ => false
  }
Console.log(isRetriable(HttpError({status: 500})))`
    const tree = checkHighlighting(source, [
      ["exception", t.definitionKeyword],
      ["HttpError", t.definition(t.atom)],
      ["status", t.definition(t.propertyName)],
      ["int", t.typeName],
      ["HttpError", t.atom, source.indexOf("switch")],
      ["502", t.number],
      ["503", t.number],
      ["504", t.number],
      ["|", t.operator, source.indexOf("502")],
      ["switch", t.controlKeyword],
      ["true", t.bool],
      ["Console.", t.namespace],
      ["500", t.number],
    ])
    assert.equal(tree.topNode.firstChild.name, "ExceptionDeclaration")
  })

  it("supports exception declarations in blocks and module signatures, and aliases", () => {
    checkHighlighting(`module type S = {
  exception Exit
  exception Message(string)
  exception Pair(int, string,)
  exception HttpError({status: int})
}
module M = {
  exception Exit
  exception Alias = Lib.Exit
  let run = () => {exception Stop; throw(Stop)}
}`, [["exception", t.definitionKeyword], ["Exit", t.definition(t.atom)], ["Lib.", t.namespace]])
  })

  it("shares inline record payload support with variant declarations", () => {
    checkHighlighting(`type response = | HttpError({status: int}) | Ok(string)`, [
      ["HttpError", t.atom], ["status", t.definition(t.propertyName)], ["Ok", t.atom],
    ])
  })

  it("supports nested alternative patterns, aliases and guards without merging switch cases", () => {
    const source = `switch value {
  | HttpError({status: (502 | 503) as code}) | Timeout if retry => true
  | ({status: 200 | 201}, [Some(x) | None], dict{"code": 200 | 201}) => false
  | _ => false
}`
    const tree = checkHighlighting(source, [
      ["code", t.definition(t.variableName)], ["if", t.controlKeyword],
      ["200", t.number],
    ])
    assert.equal(tree.topNode.firstChild.getChildren("SwitchCase").length, 3)
  })

  it("keeps highlighting consistent when editing an alternative pattern", () => {
    const source = `${"let before = true\n".repeat(20)}
exception HttpError({status: int})
let retry = error => switch error {
| HttpError({status: 502}) => true
| _ => false
}
${"let after = false\n".repeat(20)}`
    const from = source.indexOf("502") + 3
    const inserted = " | 503 | 504"
    const edited = source.slice(0, from) + inserted + source.slice(from)
    const fragments = TreeFragment.applyChanges(TreeFragment.addTree(parser.parse(source)), [
      {fromA: from, toA: from, fromB: from, toB: from + inserted.length},
    ])
    const tree = parser.parse(edited, fragments)
    const expected = [["exception", t.definitionKeyword], ["503", t.number], ["504", t.number]]
    checkHighlighting(edited, expected, tree)
    const fresh = checkHighlighting(edited, expected)
    const nodes = tree => {
      const result = []
      tree.iterate({enter(node) {result.push([node.name, node.from, node.to])}})
      return result
    }
    assert.deepEqual(nodes(tree), nodes(fresh))
  })
})
