// const script = document.createElement("script");
// const s = `console.log(\`\`\`const w = "world"; const m = \`hello \${w}\`;\`\`\`);`;
// script.text = s.replace(/```(.*?)```/g, (_, p1) => {
//   return JSON.stringify(p1);
// });
// document.head.appendChild(script);

window.addEventListener("message", (event) => {
  console.log(1);
  console.log(event);
});

window.addEventListener(
  "message",
  (event) => {
    console.log(2);
    console.log(event);
  },
  true,
);

window.postMessage("test", "*");
