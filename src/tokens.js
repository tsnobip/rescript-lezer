/* Hand-written tokenizers for ReScript tokens that can't be
   expressed by lezer's built-in tokenizer. */

import { ExternalTokenizer, ContextTracker } from "@lezer/lr";
import {
  spaces,
  newline,
  BlockComment,
  LineComment,
  JSXStartTag,
  JSXStartCloseTag,
  JSXEndTag,
  JSXIdentifier,
  LessThan,
  VariantConstructorArgsToken,
  VariantConstructorResultToken,
  TypeAngleLeftToken,
  TypeAngleRightToken,
  UnitToken,
  RegExpLiteral,
  DivisionOp,
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
export const unit = new ExternalTokenizer((input, stack) => {
  if (input.next == 40 && input.peek(1) == 41 && stack.canShift(UnitToken)) {
    input.advance(2);
    input.acceptToken(UnitToken);
  }
}, { contextual: true });

export const regexp = new ExternalTokenizer((input, stack) => {
  if (input.next != slash || !stack.canShift(RegExpLiteral) ||
      stack.canShift(DivisionOp) && !stack.context ||
      input.peek(1) == slash || input.peek(1) == star) return;
  let length = 1, inClass = false;
  for (;;) {
    const ch = input.peek(length);
    if (ch < 0 || ch == 10 || ch == 13 || ch == 8232 || ch == 8233) return;
    if (ch == 92) {
      const escaped = input.peek(++length);
      if (escaped < 0 || escaped == 10 || escaped == 13 || escaped == 8232 || escaped == 8233) return;
    } else if (ch == 91) inClass = true;
    else if (ch == 93) inClass = false;
    else if (ch == slash && !inClass) break;
    length++;
  }
  length++;
  while (input.peek(length) >= 65 && input.peek(length) <= 90 ||
      input.peek(length) >= 97 && input.peek(length) <= 122) length++;
  input.advance(length);
  input.acceptToken(RegExpLiteral);
}, { contextual: true });

export const typeAngle = new ExternalTokenizer((input, stack) => {
  if (input.next == 60 && stack.canShift(TypeAngleLeftToken)) {
    input.advance();
    input.acceptToken(TypeAngleLeftToken);
  } else if (input.next == 62 && stack.canShift(TypeAngleRightToken) && !stack.canShift(JSXEndTag)) {
    input.advance();
    input.acceptToken(TypeAngleRightToken);
  }
}, { contextual: true });

export const jsxTag = new ExternalTokenizer((input, stack) => {
  if (input.next == 62 && stack.canShift(JSXEndTag)) {
    input.advance();
    input.acceptToken(JSXEndTag);
  } else if (stack.canShift(JSXIdentifier) &&
      (input.next >= 97 && input.next <= 122 || input.next == 95)) {
    input.advance();
    while (identifierChar(input.next, false) || input.next == 36 || input.next == 45) input.advance();
    input.acceptToken(JSXIdentifier);
  }
}, { contextual: true });

export const jsx = new ExternalTokenizer((input, stack) => {
  if (input.next != lt || input.peek(1) == 61 || input.peek(1) == lt) return;
  if (stack.canShift(LessThan) && !stack.canShift(JSXStartCloseTag) &&
      !(stack.canShift(JSXStartTag) && (input.peek(1) == 62 || stack.context && identifierChar(input.peek(1), true)))) {
    input.advance();
    input.acceptToken(LessThan);
    return;
  }
  if (!stack.canShift(JSXStartTag)) return;
  input.advance();
  if (input.next == slash) return; // Could be </

  // JSX tags don't have space after <
  // If there's space, it's likely a comparison operator
  if (space.indexOf(input.next) > -1) {
    input.acceptToken(LessThan);
    return;
  }

  // If followed by an identifier character, it's JSX
  if (identifierChar(input.next, true) || input.next == 62) {
    input.acceptToken(JSXStartTag);
  } else {
    // Not an identifier, treat as less-than
    input.acceptToken(LessThan);
  }
}, { contextual: true });

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
