/* Hand-written tokenizers for ReScript tokens that can't be
   expressed by lezer's built-in tokenizer. */

import {ExternalTokenizer, ContextTracker} from "@lezer/lr"
import {insertSemi, spaces, newline, BlockComment, LineComment,
        JSXStartTag, LessThan, GreaterThan} from "./parser.terms.js"

const space = [9, 10, 11, 12, 13, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200,
               8201, 8202, 8232, 8233, 8239, 8287, 12288]

const braceR = 125, slash = 47, star = 42, lt = 60, gt = 62

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

// JSX tokenizer that also handles < and > for types and comparison
export const jsx = new ExternalTokenizer((input, stack) => {
  let next = input.next
  
  if (next == lt) {
    input.advance()
    if (input.next == slash) return // Could be </
    
    // JSX tags don't have space after <
    // If there's space, it's likely a comparison operator or type bound
    if (space.indexOf(input.next) > -1) {
      input.acceptToken(LessThan)
      return
    }
    
    // If followed by an identifier character, it's JSX
    if (identifierChar(input.next, true)) {
      input.acceptToken(JSXStartTag)
    } else {
      // Not an identifier, treat as less-than (for types or comparison)
      input.acceptToken(LessThan)
    }
  } else if (next == gt) {
    input.advance()
    input.acceptToken(GreaterThan)
  }
})

