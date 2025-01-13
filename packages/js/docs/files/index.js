/* this file is created by the @magicsandbox.ai/docs package. do not edit manually as it will be overwritten */

/* global requestUrlParams */

async function scrollToId() {
  const { id } = await requestUrlParams;
  if (id) {
    const anchor = document.getElementById(id);
    if (anchor) {
      anchor.scrollIntoView({ behavior: "smooth" });
    }
  }
}

scrollToId();

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const id = entry.target.getAttribute("id");
      if (entry.isIntersecting) {
        document
          .querySelector(`#nav a[href="#${id}"]`)
          .classList.add("font-bold");
      } else {
        document
          .querySelector(`#nav a[href="#${id}"]`)
          .classList.remove("font-bold");
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
