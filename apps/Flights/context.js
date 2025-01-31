function context() {
  return `

Rather than hard filters, user preferences are expressed using penalties. Penalties are a more realistic model of user preferences. For example, if a user says "I want to leave after 6pm", they probably would consider a flight that leaves at 5:45pm.

The units for penalties are dollars. Flights are then ranked from lowest to highest by how much they cost plus any penalties.

To add a penalty, call app.api.addPenalty(name, penaltyFunction):

- name (string): the name of the penalty displayed in the UI so the user can toggle it on and off
- penaltyFunction ((Flight) => number): a function that takes a Flight and returns the penalty in dollars

For example, if the user says "I want to leave after 6pm", you can add a penalty like this:

~~~
app.api.addPenalty("leave after 6pm", (flight) => {
  //1 dollar penalty for each minute before 6pm, otherwise 0
});
~~~

To edit a penalty, first remove it, then add a new one. For example, if the user says "penalize leaving before 6pm more":

~~~
app.api.removePenalty("leave after 6pm");
app.api.addPenalty("leave after 6pm", (flight) => {
  //10 dollar penalty for each minute before 6pm, otherwise 0
});
~~~

todo maybe the user can config the penalty function somehow?

~~~
app.api.addPenalty({
  name: "Leave after 6pm",
  options: {
    penaltyPerMinute: {
      type: "number",
      default: 1,
      friendlyName: "Penalty per minute",
      description: "The penalty per minute to apply for each minute the flight leaves before 6pm",
    },
  },
  penaltyFunction: (flight, options) => {
    //options.penaltyPerMinute for each minute before 6pm, otherwise 0
  }
});
~~~

Penalties can be used to effectively create hard filters. For example, if the user says "I absolutely can't leave before 6pm", you can add a penalty like this:

~~~
app.api.addPenalty("can't leave before 6pm", (flight) => {
  //10000 dollar penalty if flight is before 6pm, otherwise 0
});
~~~

`;
}

export { context };
