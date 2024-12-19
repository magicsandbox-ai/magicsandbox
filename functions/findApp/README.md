Finds an appropriate Magic App based on user input.

**Argument:** an object with keys:

- `input` (**required**) (string): User input.
- `maxCost` (number) (default 0.001): Maximum cost you're willing to pay for the App call.
- `appWeights` ({ [app: string]: number }): Weight multiplier to apply to each Magic App.
  - Weights greater than 1 make the App more likely to be selected.
  - Weights less than 1 make the App less likely to be selected.
  - Weights of 0 or below exclude the App from being selected.

**Returns:** a string, the selected Magic App.
