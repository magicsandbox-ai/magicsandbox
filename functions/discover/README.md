# magicsandbox.discover

Given a query, returns relevant Magic Sandbox Apps and/or Functions.

## Arguments

An object with keys:

- `query` _(**required**, string)_: The query to search for
- `includeMetadata` _(string[], default ['id'])_: Array of metadata keys to include. See [here](https://magicsandbox.ai/?_app=magicsandbox.Docs#app-and-function-metadata) for available keys
- `kind` _("app" | "function")_: Whether to return Apps or Functions. If not provided, both are returned
- `limit` _(number, default 10, max 100)_: Maximum number of results to return

## Returns

An array of objects with:

- All keys specified in `includeMetadata`
- A `relevance` score between 0 and 1 indicating how well the result matches the query, where higher scores indicate a more relevant match

Returns the latest undeprecated version of each App or Function, sorted by relevance descending.
