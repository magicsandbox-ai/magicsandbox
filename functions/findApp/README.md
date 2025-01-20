Finds Magic Apps that are relevant to a user input.

**Argument:** an object with keys:

- `input` (**required**) (string): User input.
- `maxCost` (number) (default 0.001): Maximum cost you're willing to pay for the App call.
- `apps` (string[]): Up to 10 Apps to include in the result, regardless of score. Should be in the form of author.name@version or author.name.
- `rating` ({ inputId: string, app: string, rating: number }): A user rating for a previous input and App combination. This is only used if the caller is `magicsandbox.Assistant`.

**Returns:** an object with keys:

- `inputEmbedding` (number[]): Embedding of the user input.
- `apps` (object[]): The top 10 Apps by score, as well as any Apps passed in the `apps` argument.
  - `app` (string): App.
  - `embedding` (number[]): Embedding of the App.
  - `score` (number): Score of the App, which is the dot product of the App's embedding and inputEmbedding.
  - `minCost` (number): The minimum cost to call the App.
- `inputId` (string): An ID that can be used to supply a future rating.
