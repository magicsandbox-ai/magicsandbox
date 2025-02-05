Finds Magic Apps that are relevant to a user input.

**Arguments:** an object with keys:

- `input` _(**required**, string)_: User input.
- `maxCost` _(number, default 0.001)_: Maximum cost you're willing to pay for the App call.

**Returns:** an array of object with the following keys. Refer to the [docs](https://magicsandbox.ai/?app=magicsandbox.Docs) for details.

- `id` (string)
- `description` (string)
- `minCost` (number)
- `finalCost` (number)
