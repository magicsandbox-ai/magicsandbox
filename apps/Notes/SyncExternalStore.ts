class SyncExternalStore<T extends { [key: string]: unknown }> {
  _subscribers: { [K in keyof T]?: (() => void)[] } = {};
  _props: Partial<T> = {};

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
      return this._props[prop] as T[K];
    };
  }
  set<K extends keyof T>(prop: K, value: T[K]) {
    this._props[prop] = value;
    this._subscribers[prop]?.forEach((subscriber) => subscriber());
  }
}

export default SyncExternalStore;
