class SyncExternalStore {
  _subscribers: { [prop: string]: (() => void)[] } = {};
  _props: { [prop: string]: unknown } = {};
  subscribe(prop: string) {
    return (callback: () => void) => {
      if (!this._subscribers[prop]) {
        this._subscribers[prop] = [];
      }
      this._subscribers[prop].push(callback);
      return () => {
        this._subscribers[prop] = this._subscribers[prop]!.filter(
          (subscriber) => subscriber !== callback,
        );
      };
    };
  }
  getSnapshot(prop: string) {
    return () => {
      return this._props[prop] as any;
    };
  }
  set(prop: string, value: unknown) {
    this._props[prop] = value;
    this._subscribers[prop]?.forEach((subscriber) => subscriber());
  }
}

class Flight {
  constructor(public id: string) {}
}

class FlightsState extends SyncExternalStore {
  constructor() {
    super();
    this.set("flights", []);
  }
  async search() {
    const { result: flights } = await requestFunction<any, Flight[]>(
      "magicsandbox.flightSearch",
      {},
      { maxCost: 0.02 },
    );
    this.set("flights", flights);
  }
  context(init = false) {
    return `This is a flight search app.`;
  }
}

export { Flight, FlightsState };
