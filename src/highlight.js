import { styleTags, tags as t } from "@lezer/highlight";

export const rescriptHighlight = styleTags({
  "let type external exception := and as": t.definitionKeyword,
  "if else switch when while for in to downto try catch async await":
    t.controlKeyword,
  "module open include with": t.moduleKeyword,
  "private rec mutable": t.typeOperator,

  BooleanLiteral: t.bool,

  ModuleDeclaration: t.namespace,
  ModuleTypeDeclaration: t.namespace,
  ModuleTypeModuleSpec: t.namespace,
  ModulePackExpression: t.namespace,
  ModulePath: t.namespace,
  ModulePrefix: t.namespace,
  ModuleName: t.namespace,
  "ModuleDeclaration/ModuleName ModuleTypeDeclaration/ModuleName": t.definition(
    t.namespace
  ),
  ModuleUnpackBinding: t.definition(t.variableName),

  OpenStatement: t.moduleKeyword,
  IncludeStatement: t.moduleKeyword,

  LetBinding: t.definitionKeyword,
  LetValueBinding: t.definition(t.variableName),
  ValueSpec: t.definition(t.variableName),

  TypeDeclaration: t.definition(t.typeName),
  TypeBinding: t.definition(t.typeName),
  "TypeBinding/TypeName": t.definition(t.typeName),
  TypeSpec: t.definition(t.typeName),
  TypeAlias: t.typeName,
  TypeBody: t.typeName,
  TypeApplication: t.typeName,
  TypeParams: t.typeName,
  TypeParam: t.typeName,
  "TypeParameter!": t.typeName,
  TypeAngleLeftNode: t.angleBracket,
  TypeAngleRightNode: t.angleBracket,
  FunctionType: t.typeName,
  FunctionArrow: t.operator,
  ParenthesizedType: t.paren,

  RecordType: t.typeName,
  RecordTypeField: t.propertyName,

  VariantType: t.typeName,
  VariantConstructorCase: t.atom,
  VariantConstructor: t.atom,
  VariantSpreadCase: t.operator,
  VariantLiteral: t.atom,

  PolyVariantType: t.typeName,
  PolyVariantCaseList: t.typeName,
  PolyVariantCase: t.typeName,
  PolyVariantTagCase: t.atom,
  PolyVariantSpreadCase: t.operator,
  PolyVariantTypeReference: t.typeName,
  PolyVariantVarianceMarker: t.operator,
  PolyVariantLiteral: t.atom,
  PolyVariantTag: t.atom,
  PolyVariantName: t.atom,

  RegExpLiteral: t.regexp,

  PatternGuard: t.controlKeyword,
  VariantSpreadPattern: t.operator,
  PolyVariantPattern: t.atom,
  PolyVariantSpreadPattern: t.operator,

  "Decorator Decorator/@ Decorator/@@": t.annotation,
  "AttributeIdentifier AttributeArguments/( AttributeArguments/)": t.annotation,
  "ExtensionExpression ExtensionExpression/% ExtensionExpression/%%":
    t.annotation,
  Property: t.propertyName,
  PropertyDefinition: t.definition(t.propertyName),
  PropertyName: t.propertyName,
  "MemberExpression/String": t.propertyName,

  LabeledParameter: t.labelName,
  "SimpleParameter/VariableName": t.labelName,
  LabelName: t.labelName,
  "ArrowFunction/UnitToken": t.labelName,
  "ArrowFunction/SingleParam/VariableName": t.labelName,
  "ArrowFunction/ParenthesizedExpression/VariableName": t.labelName,
  "ArrowFunction/ParamList/ParamItems/UnlabeledParameter/VariableName":
    t.labelName,
  "ArrowFunction/ParamList/ParamItems/LabelParameter/VariableName": t.labelName,

  ParameterAnnotation: t.typeName,

  Quote: t.string,
  Hash: t.operator,

  VariableName: t.variableName,
  VariableDefinition: t.definition(t.variableName),
  exoticIdentifier: t.variableName,
  TypeName: t.typeName,

  Number: t.number,
  String: t.string,
  TemplateString: t.string,
  TemplateContent: t.special(t.string),
  Char: t.character,
  Escape: t.escape,
  ShiftOp: t.operator,
  BitAndOp: t.operator,
  BitOrOp: t.operator,
  BitXorOp: t.operator,
  BitNotOp: t.operator,
  ArithOp: t.arithmeticOperator,
  LogicOp: t.logicOperator,
  CompareOp: t.compareOperator,
  StringOp: t.operator,
  PipeOp: t.operator,
  "( )": t.paren,
  "[ ]": t.squareBracket,
  "{ }": t.brace,
  ". , : ;": t.separator,
  "=> =": t.definitionOperator,
  "~ ?": t.modifier,
  "|": t.separator,
  _: t.keyword,
  LineComment: t.lineComment,
  BlockComment: t.blockComment,

  JSXElement: t.content,
  "JSXStartTag JSXEndTag JSXSelfCloseEndTag JSXStartCloseTag": t.special(
    t.angleBracket
  ),
  "JSXIntrinsicElementName/JSXIdentifier": t.tagName,
  "JSXCustomComponentName/ModulePath/ModuleName": t.special(t.tagName),
  "JSXAttribute/JSXIdentifier": t.attributeName,
  JSXExpressionContainer: t.content,
  JSXText: t.content,
});
