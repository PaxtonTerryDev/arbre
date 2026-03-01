import { Layer } from "./layer";
import { Log } from "./types/log";

export class Arbre {
  private static _instance: Arbre | null = null;

  private constructor() { }

  static get_instance(): Arbre {
    if (this._instance === null) {
      this._instance = new Arbre();
    }
    return this._instance;
  }

  private _layers: Layer[] = [];
  public async handleLog<Payload, Scope>(log: Log<Payload, Scope>): Promise<void> {
    let current: Log<Payload, Scope> | null = log;
    for (const layer of this._layers) {
      current = await (layer as Layer<Payload, Scope>).handle(current);
      if (current === null) break;
    }
  }

  public addLayer<Payload, Scope>(layer: Layer<Payload, Scope>): void {
    this._layers.push(layer);
  }
}

