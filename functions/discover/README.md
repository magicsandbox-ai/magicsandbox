# magicsandbox.discover

Given a query, returns relevant Magic Sandbox Apps and/or Functions.

## Arguments

An object with keys:

- `query` _(**required**, string)_: The query to search for
- `includeMetadata` _(**required**, string[])_: Array of metadata keys to include. See [here](https://magicsandbox.ai/?_app=magicsandbox.Docs#app-and-function-metadata) for available keys
- `kind` _("app" | "function")_: Whether to return Apps or Functions. If not provided, both are returned

## Returns

An array of objects with the keys specified in `includeMetadata`.
