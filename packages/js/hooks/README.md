**Note: this package has not yet been published. Please create an issue if you'd like to use it.**

# @magicsandbox.ai/hooks

@magicsandbox.ai/hooks provides custom React hooks for Magic Sandbox.

## Installation

`npm install @magicsandbox.ai/hooks`

## usePersistentState

`usePersistentState` provides an interface similar to React's `useState`, but the state is persisted using the Sandbox functions `requestGetData` and `requestPutData`.

### Usage

```javascript
import { usePersistentState } from "@magicsandbox.ai/hooks";

// ... in your component ...
const [myState, setMyState] = usePersistentState("myState");
```

This replaces your code that looks like this:

```javascript
const [myState, setMyState] = useState(null);

useEffect(() => {
  async function loadMyState() {
    const myState = await requestGetData("myState");
    setMyState(myState);
  }
  loadMyState();
}, []);

useEffect(() => {
  if (myState !== null) {
    requestPutData("myState", myState);
  }
}, [myState]);
```

### Arguments

`usePersistentState(key, defaultValue, options)`

- `key` _(**required**, string)_: The key to use for storage
- `initialState` _(any)_: The initial state value to use before data is loaded from storage. If they key does not exist in storage, this value will continue to be used.
- `options` _(object)_: Additional options. Additional keys not listed here are passed to `requestGetData` and `requestPutData`.
  - `debounceMs` _(number, default 300)_: The number of milliseconds to wait before calling `requestPutData`, improving performance when many updates are made in quick succession. Set to 0 to disable debouncing.
  - `onError` _(function)_: A callback function that will be called when an error occurs during loading or saving state. The function receives two arguments: the error object and an object containing the arguments passed to `requestGetData` or `requestPutData`.

```javascript
const [myState, setMyState] = usePersistentState("myState", "myDefaultValue", {
  debounceMs: 1000,
  onError: (error, args) => {
    if ("value" in args) {
      console.error(
        `usePersistentState error saving key "${args.key}":`,
        error,
      );
    } else {
      console.error(
        `usePersistentState error loading key "${args.key}":`,
        error,
      );
    }
  },
  app: "myName.myApp",
  evictionPolicy: "fifo",
});
```
