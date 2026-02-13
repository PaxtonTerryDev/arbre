import { Arbre } from "./src/arbre";
import { info } from "./src";
import { Stdout } from "./src/layer/stdout-layer";

const arbre = Arbre.get_instance();
arbre.addLayer(new Stdout());
const log = info("Hello World!", {
  scope: "Bingus",
  payload: {
    processId: 69,
    parentProcess: 420,
  },
});

console.dir(log, { depth: null });
