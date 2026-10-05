import assert from "node:assert/strict"
import {highlightTree, tags as t} from "@lezer/highlight"
import {parser} from "../dist/index.js"

function checkHighlighting(source, expected) {
  const tree = parser.parse(source)
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
  | HttpError({status: 502}) => true
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
})
