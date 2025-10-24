import { parser } from "../dist/index.js";
import assert from "assert";

const advancedSample = `
open Belt

include MyLib

type person<'a> = {
  name: string,
  data: 'a,
}

type color =
  | Red
  | Green

external log: string => unit = "log"

let makePerson = (~name, ~data=?, unit) => {
  {
    name: name,
    data: switch data {
      | Some(value) => value
      | None => "unknown"
    },
  }
}

makePerson(~name="Ada", ~data=?Some("ok"), unit)
`;

describe("advanced-rescript", () => {
  it("parses declarations and labelled arguments", () => {
    const tree = parser.parse(advancedSample);
    assert(tree, "parse tree should be produced");
  });
});
