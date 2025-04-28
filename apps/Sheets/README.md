IronCalc fork: https://github.com/magicsandbox-ai/IronCalc

Building @ironcalc/workbook - there is almost certainly a better way to do this:

1. `cd IronCalc/webapp/IronCalc`
2. `npm install`
3. `npm run build`
4. Delete `IronCalc/webapp/IronCalc/node_modules/react` and `IronCalc/webapp/IronCalc/node_modules/react-dom`. This is necessary to avoid two copies of React

Build @ironcalc/wasm following the instructions in IronCalc/bindings/wasm/README.md
