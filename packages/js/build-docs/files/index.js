/* this file is created by the @magicsandbox.ai/build-docs package. do not edit manually as it will be overwritten */
import markdown from "../index.md";

const navLinks = Object.fromEntries(
  Array.from(document.querySelectorAll("#nav a")).map((a) => {
    const url = new URL(a.href);
    const id = url.searchParams.get("id");
    return [id, a];
  }),
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
          el.classList.add("text-shadow");
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        linksToUnbold.forEach((id) => {
          boldLinks.delete(id);
          navLinks[id]?.classList.remove("text-shadow");
        });
        linksToUnbold = [];
      } else {
        if (boldLinks.size > 1) {
          boldLinks.delete(id);
          navLinks[id]?.classList.remove("text-shadow");
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
  .querySelectorAll("h1, h2, h3") //this should match maxDepth in remarkToc
  .forEach((h) => {
    observer.observe(h);
  });

document.addEventListener("click", (e) => {
  if (e.target.href) {
    e.preventDefault();
    const url = new URL(e.target.href);
    const app = url.searchParams.get("app");
    const id = url.searchParams.get("id");
    if (app === "magicsandbox.Docs" && id) {
      scrollToId(id);
    } else {
      requestOpenUrl(e.target.href);
    }
  }
});

async function init({ urlParams }) {
  const { id } = urlParams;
  if (id) {
    scrollToId(id);
  }
}

function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth" });
  }
}

function context() {
  return markdown;
}

export { init, context };
