/* Hand-written tokenizers for ReScript tokens that can't be
   expressed by lezer's built-in tokenizer. */

import {ExternalTokenizer, ContextTracker} from "@lezer/lr"
import {insertSemi, spaces, newline, BlockComment, LineComment,
        JSXStartTag, Dialect_jsx} from "./parser.terms.js"

const space = [9, 10, 11, 12, 13, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200,
               8201, 8202, 8232, 8233, 8239, 8287, 12288]

const braceR = 125, slash = 47, star = 42, lt = 60

export const trackNewline = new ContextTracker({
  start: false,
  shift(context, term) {
    return term == LineComment || term == BlockComment || term == spaces ? context : term == newline
  },
  strict: false
})

export const insertSemicolon = new ExternalTokenizer((input, stack) => {
  let {next} = input
  if (next == braceR || next == -1 || stack.context)
    input.acceptToken(insertSemi)
}, {contextual: true, fallback: true})

function identifierChar(ch, start) {
  return ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122 || ch == 95 || ch >= 192 ||
    !start && ch >= 48 && ch <= 57
}

export const jsx = new ExternalTokenizer((input, stack) => {
  if (input.next != lt || !stack.dialectEnabled(Dialect_jsx)) return
  input.advance()
  if (input.next == slash) return
  // Scan for JSX element start
  let back = 0
  while (space.indexOf(input.next) > -1) { input.advance(); back++ }
  if (identifierChar(input.next, true)) {
    input.advance()
    back++
    while (identifierChar(input.next, false)) { input.advance(); back++ }
  }
  input.acceptToken(JSXStartTag, -back)
})

