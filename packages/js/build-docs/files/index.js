/* this file is created by the @magicsandbox.ai/build-docs package. do not edit manually as it will be overwritten */
import markdown from "../index.md";

const navLinks = Object.fromEntries(
  Array.from(document.querySelectorAll("nav a")).map((a) => {
    const url = new URL(a.href);
    const hash = url.hash?.slice(1); //remove leading #
    return [hash, a];
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
  .querySelector("main")
  .querySelectorAll("h1, h2, h3") //this should match maxDepth in remarkToc
  .forEach((h) => {
    observer.observe(h);
  });

document.addEventListener("click", (e) => {
  if (e.target.href && !e.ctrlKey && !e.shiftKey) {
    e.preventDefault();
    const baseUrl = new URL(document.baseURI);
    const baseApp = baseUrl.searchParams.get("_app");
    const url = new URL(e.target.href);
    const app = url.searchParams.get("_app");
    const hash = url.hash?.slice(1); //remove leading #
    if (app === baseApp && hash) {
      scrollToHash(hash);
    } else {
      requestOpenUrl(e.target.href);
    }
  }
});

async function init() {
  const urlParams = await requestUrlParams();
  const { hash } = urlParams;
  if (hash) {
    scrollToHash(hash);
  }
}

function scrollToHash(hash) {
  const el = document.getElementById(hash);
  if (el) {
    el.scrollIntoView({ behavior: "smooth" });
  }
}

function context() {
  return markdown;
}

export { init, context };
