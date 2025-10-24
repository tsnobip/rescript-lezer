/* Hand-written tokenizers for ReScript tokens that can't be
   expressed by lezer's built-in tokenizer. */

import { ExternalTokenizer, ContextTracker } from "@lezer/lr";
import {
  spaces,
  newline,
  BlockComment,
  LineComment,
  JSXStartTag,
  LessThan,
  VariantConstructorArgsToken,
  VariantConstructorResultToken,
} from "./parser.terms.js";

const space = [
  9, 10, 11, 12, 13, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197,
  8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288,
];

const braceR = 125,
  slash = 47,
  star = 42,
  lt = 60,
  parenL = 40,
  colon = 58,
  dot = 46;

export const trackNewline = new ContextTracker({
  start: false,
  shift(context, term) {
    return term == LineComment || term == BlockComment || term == spaces
      ? context
      : term == newline;
  },
  strict: false,
});

// insertSemicolon removed — grammar no longer declares this external tokenizer.

function identifierChar(ch, start) {
  return (
    (ch >= 65 && ch <= 90) ||
    (ch >= 97 && ch <= 122) ||
    ch == 95 ||
    ch >= 192 ||
    (!start && ch >= 48 && ch <= 57)
  );
}

// JSX tokenizer that also handles < comparison
export const jsx = new ExternalTokenizer((input, stack) => {
  if (input.next != lt) return;
  input.advance();
  if (input.next == slash) return; // Could be </

  // JSX tags don't have space after <
  // If there's space, it's likely a comparison operator
  if (space.indexOf(input.next) > -1) {
    input.acceptToken(LessThan);
    return;
  }

  // If followed by an identifier character, it's JSX
  if (identifierChar(input.next, true)) {
    input.acceptToken(JSXStartTag);
  } else {
    // Not an identifier, treat as less-than
    input.acceptToken(LessThan);
  }
});

export const variant = new ExternalTokenizer((input) => {
  let ch = input.next;
  if (ch < 65 || ch > 90) return;

  let len = 1;
  while (identifierChar(input.peek(len), false)) len++;

  let next = input.peek(len);
  if (next == dot) return;

  let term = null;
  if (next == parenL) term = VariantConstructorArgsToken;
  else if (next == colon) term = VariantConstructorResultToken;
  else return;

  for (let i = 0; i < len; i++) input.advance();
  input.acceptToken(term);
}, { contextual: true });
