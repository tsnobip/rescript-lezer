/* Hand-written tokenizers for ReScript tokens that can't be
   expressed by lezer's built-in tokenizer. */

import { ExternalTokenizer, ContextTracker } from "@lezer/lr";
import {
  spaces,
  newline,
  BlockComment,
  TypeBinding,
  TypeDeclaration,
  TypeSpec,
  LetValueBinding,
  LetRecBinding,
  LetBinding,
  ModuleDeclarationBody,
  ModuleDeclaration,
  Decorator,
  and as AndKeyword,
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
  IndexOpen,
  RegExpLiteral,
  DivisionOp,
  TernaryColon,
  ModuleUnpackColon,
  AttributeArgsOpen,
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

const newlineContext = 1, bindingContext = 2;
const lineBreak = /[\r\n\u2028\u2029]/;
const bindings = [TypeBinding, LetValueBinding, LetRecBinding, ModuleDeclarationBody];
const declarations = [TypeDeclaration, TypeSpec, LetBinding, ModuleDeclaration];

// Reused decorators must distinguish binding continuations from new declarations.
export const trackContext = new ContextTracker({
  start: 0,
  shift(context, term, stack, input) {
    if (term == BlockComment) return lineBreak.test(input.read(input.pos, stack.pos)) ? context | newlineContext : context;
    if (term == LineComment || term == spaces) return context;
    return (term == AndKeyword ? 0 : context & bindingContext) | (term == newline ? newlineContext : 0);
  },
  reduce(context, term) {
    if (bindings.includes(term)) return context | bindingContext;
    if (declarations.includes(term)) return context & newlineContext;
    return context;
  },
  reuse(context, node, stack, input) {
    const term = node.type.id;
    if (term == BlockComment) return lineBreak.test(input.read(input.pos, stack.pos)) ? context | newlineContext : context;
    if (term == LineComment) return context;
    if (bindings.includes(term)) return bindingContext;
    if (term == Decorator) return context & bindingContext;
    return 0;
  },
  hash(context) { return context; },
});

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
export const comments = new ExternalTokenizer(input => {
  if (input.next != slash || input.peek(1) != star) return;
  input.advance(2);
  let depth = 1;
  while (input.next >= 0) {
    if (input.next == slash && input.peek(1) == star) {
      depth++;
      input.advance(2);
    } else if (input.next == star && input.peek(1) == slash) {
      input.advance(2);
      if (--depth == 0) {
        input.acceptToken(BlockComment);
        return;
      }
    } else input.advance();
  }
});

export const postfix = new ExternalTokenizer((input, stack) => {
  if (input.next == 91 && !(stack.context & newlineContext) && stack.canShift(IndexOpen)) {
    input.advance();
    input.acceptToken(IndexOpen);
  }
}, { contextual: true });

export const unit = new ExternalTokenizer((input, stack) => {
  if (input.next == 40 && input.peek(1) == 41 && stack.canShift(UnitToken)) {
    input.advance(2);
    input.acceptToken(UnitToken);
  }
}, { contextual: true });

export const regexp = new ExternalTokenizer((input, stack) => {
  if (input.next != slash || !stack.canShift(RegExpLiteral) ||
      stack.canShift(DivisionOp) && !(stack.context & newlineContext) ||
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

export const ternaryColon = new ExternalTokenizer((input, stack) => {
  if (input.next == colon && input.peek(1) != 62 && input.peek(1) != 61) {
    const term = stack.canShift(ModuleUnpackColon) ? ModuleUnpackColon : TernaryColon;
    if (!stack.canShift(term)) return;
    input.advance();
    input.acceptToken(term);
  }
}, { contextual: true });

export const attributeArgs = new ExternalTokenizer((input, stack) => {
  if (input.next == parenL && identifierChar(input.peek(-1), false) && stack.canShift(AttributeArgsOpen)) {
    input.advance();
    input.acceptToken(AttributeArgsOpen);
  }
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
  let offset = 1;
  while (space.includes(input.peek(offset))) offset++;
  const next = input.peek(offset);
  if (next == slash && stack.canShift(JSXStartCloseTag)) {
    input.advance(offset + 1);
    input.acceptToken(JSXStartCloseTag);
  } else if (stack.canShift(LessThan) &&
      !(stack.canShift(JSXStartTag) && (next == 62 || (stack.context & newlineContext) && identifierChar(next, true)))) {
    input.advance();
    input.acceptToken(LessThan);
  } else if (stack.canShift(JSXStartTag) && (identifierChar(next, true) || next == 62)) {
    input.advance();
    input.acceptToken(JSXStartTag);
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
