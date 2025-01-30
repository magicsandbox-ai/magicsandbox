/* this file is created by the @magicsandbox.ai/docs package. do not edit manually as it will be overwritten */
import markdown from "./index.md";

async function scrollToId() {
  const { id } = window.args.urlParams;
  if (id) {
    const anchor = document.getElementById(id);
    if (anchor) {
      anchor.scrollIntoView({ behavior: "smooth" });
    }
  }
}

scrollToId();

const navLinks = Object.fromEntries(
  Array.from(document.querySelectorAll("#nav a")).map((a) => [
    a.href.split("#")[1],
    a,
  ]),
);
const boldLinks = new Set();
let linksToUnbold = [];

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const id = entry.target.getAttribute("id");
      if (entry.isIntersecting) {
        boldLinks.add(id);
        const el = navLinks[id];
        if (el) {
          el.classList.add("font-bold");
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        linksToUnbold.forEach((id) => {
          boldLinks.delete(id);
          navLinks[id]?.classList.remove("font-bold");
        });
        linksToUnbold = [];
      } else {
        if (boldLinks.size > 1) {
          boldLinks.delete(id);
          navLinks[id]?.classList.remove("font-bold");
        } else {
          linksToUnbold.push(id);
        }
      }
    });
  },
  { threshold: 0.1 },
);

document
  .getElementById("main")
  .querySelectorAll("h1, h2, h3, h4, h5, h6")
  .forEach((h) => {
    observer.observe(h);
  });

document.getElementById("main").addEventListener("click", (e) => {
  if (e.target.href) {
    e.preventDefault();
    requestOpenUrl(e.target.href);
  }
});

function context() {
  return markdown;
}

export { context };
