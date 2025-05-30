class SyncExternalStore<T extends { [key: string]: unknown }> {
  private _subscribers: { [K in keyof T]?: (() => void)[] } = {};
  private _props: T;

  constructor(defaultProps: T) {
    this._props = defaultProps;
  }

  subscribe<K extends keyof T>(prop: K) {
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

  getSnapshot<K extends keyof T>(prop: K) {
    return () => {
      return this._props[prop];
    };
  }

  get<K extends keyof T>(prop: K) {
    return this._props[prop];
  }

  set<K extends keyof T>(prop: K, value: T[K]) {
    this._props[prop] = value;
    this._subscribers[prop]?.forEach((subscriber) => subscriber());
  }
}

export default SyncExternalStore;
