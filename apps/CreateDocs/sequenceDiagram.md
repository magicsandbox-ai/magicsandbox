# Full

```mermaid
sequenceDiagram
    autonumber
    User->>Server: input
    Server->>Auction: args, prize
    Bidders->>Auction: bid, fn
    Auction->>Server: winning bid, fn
    Server->>Client: args, static result
    Client->>Sandbox: args, static result
    Server->>Function: args (code or endpoint)
    Function->>Server: dynamic result
    Server->>Client: args, dynamic result
    Client->>Sandbox: args, dynamic result
    Sandbox->>Client: request
    Client->>User: request (if needed)
    User->>Client: approval
    Client->>Server: function, publish
    Client->>Local DB: get, put, delete
    Local DB->>Cloud DB: sync
    Cloud DB->>Other Devices: sync
    Client->>Internet: fetch, openUrl
    Bidder->>Function: cost
    User->>Server: thumbs up
    Server->>Bidder: prize
    User->>Server: thumbs down
    Bidder->>Server: bid
```

# Auction

```mermaid
sequenceDiagram
    autonumber
    User->>Server: input
    Server->>Auction: args, prize
    Bidders->>Auction: bid, fn
    Auction->>Server: winning bidder, bid, fn
```

# Function

This one needs some work

```mermaid
sequenceDiagram
autonumber
participant Function
participant Server
Note over Client: User Input
Note over Client: Update Context with Input
Client->>Server: Context
Note over Server: Determine Function
Server->>Client: StaticResult
Client->>Sandbox: Input, StaticResult
Note over Sandbox: Process StaticResult
Server->>Function: Context
Function->>Server: DynamicResult
Server->>Client: DynamicResult
Client->>Sandbox: DynamicResult
Note over Sandbox: Process DynamicResult
Note over Client: Update Context using StaticResult and DynamicResult
```

Processing StaticResult:
input saved to window.input, can be overwritten so save it if needed

Processing DynamicResult:
reset/style/html/dependencies/script processed same way as StaticResult
output saved to window.output, can be overwritten so save it if needed
if none of these keys are present, if streamDynamic is true, or if decodeDynamic is false, the entire DynamicResult is saved to window.output
for example, a dynamicResult:

```javascript
{
  someKey: "someValue",
  anotherKey: "anotherValue",
}
```

is treated the same as:

```javascript
{
  output: {
    someKey: "someValue",
    anotherKey: "anotherValue",
  },
}
```

```mermaid
classDiagram
direction LR
class StaticResult {
    reset: boolean
    style: string
    html: string
    dependencies: string[]
    script: string
}
StaticResult --> Context : reset updates resets
StaticResult --> Context : html/style/dependencies/script update writes
class DynamicResult {
    reset: boolean
    style: string
    html: string
    dependencies: string[]
    script: string
    output: any
    context: string
}
note for DynamicResult "DynamicResult may also be any type,<br>in which case it's treated as output.<br>See 'Processing DynamicResult.'"
DynamicResult --> Context : reset updates resets
DynamicResult --> Context : html/style/dependencies/script update writes
DynamicResult --> Context : context updates contexts
class Context {
    inputs: string[]
    functions: string[]
    resets: boolean[]
    writes: boolean[]
    contexts: string[]
}
```

resets/writes if either static or dynamic

# Sandbox

```mermaid
sequenceDiagram
    autonumber
    Sandbox->>Client: request
    Client->>User: request (if needed)
    User->>Client: approval
    Client->>Server: requestFunction, requestPublish
    Client->>Internet: requestFetch, requestOpenUrl
    Client->>Local DB: requestPutData, requestDeleteData, requestGetData, requestGetAllData, requestGetAllKeysData
    Local DB->>Cloud DB: sync
    Cloud DB->>Other Devices: sync
```

# Payments

## Thumbs Up

```mermaid
sequenceDiagram
    autonumber
    Note over User: Thumbs Up
    User->>Bidder: prize
    Bidder->>Function: cost
```

## Thumbs Down

```mermaid
sequenceDiagram
    autonumber
    Note over User: Thumbs Down
    Bidder->>User: bid
    Bidder->>Function: cost
```

## No Feedback

```mermaid
sequenceDiagram
    autonumber
    Note over User: No Feedback
    Bidder->>Function: cost
```

## Magic Bang

```mermaid
sequenceDiagram
    autonumber
    Note over User: Input, Auction 1
    Bidder 1->>Function 1: cost1
    Note over User: Thumbs Up
    User->>Bidder 1: prize1
    Note over User: Magic Input, Auction 2
    Bidder 2->>Bidder 1: bid2 - bid1
    Bidder 2->>Function 2: cost2
    Note over User: Thumbs Down
    Bidder 2->>User: bid1
```
