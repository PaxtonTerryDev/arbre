import { Layer } from "./layer";
import { Log } from "./types/log";

export class Arbre {
  private static _instance: Arbre | null = null;

  private constructor() {}

  static get_instance(): Arbre {
    if (this._instance === null) {
      this._instance = new Arbre();
    }
    return this._instance;
  }

  private _layers: Layer[] = [];
  public handleLog<Payload, Scope>(log: Log<Payload, Scope>): void {
    for (const layer of this._layers) {
      layer.handle(log);
    }
  }

  public addLayer<Payload, Scope>(layer: Layer<Payload, Scope>): void {
    this._layers.push(layer);
  }
}

// class ArbreLogger<Payload, Scope>
