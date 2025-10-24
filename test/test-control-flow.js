import { parser } from "../dist/index.js";
import assert from "assert";

const controlFlowSample = `
let evaluate = (condition) => {
  if condition {
    let value = 1
    value + 1
  } else {
    0
  }
}

while keepRunning {
  performStep()
}

for i in 0 to 3 {
  log(i)
}

try {
  risky()
} catch {
  | Some(e) => handle(e)
  | None => 0
}
`;

describe("control-flow", () => {
  it("parses control flow constructs", () => {
    const tree = parser.parse(controlFlowSample);
    assert(tree, "parse tree should be produced");
  });
});
