import React, { useState, useEffect, createElement, Fragment } from 'react';
import { createRoot } from 'react-dom/client';
import rehypeReact from 'rehype-react';
import * as prod from 'react/jsx-runtime';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { toc } from 'mdast-util-toc';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import mermaid from 'mermaid';
import { visit } from 'unist-util-visit';
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';
import rehypeHighlight from 'rehype-highlight';

//todo use shared/Markdown.js

const initMarkdown = `
# hello world!
testing testing

~~~mermaid
sequenceDiagram
    autonumber
    User->>Server: input
    Server->>Auction: args, prize
    Bidders->>Auction: bid, fn
    Auction->>Server: winning bidder, bid, fn
~~~

long

long

long

long

long

long

long

long
## hello there
ignore me

long

long

long

long

long

long

long

long
### this is a very very very very very very very very very long heading
no

long

long

long

long

long

long

long

long
# okay
yeah okay

long

long

long

long

long

long

long

long
## bye
bye

long

long

long

long

~~~javascript
{
  esbuildOptions: {
    runEsbuild: 'detect',
    bundle: true,
    loader: { '.js': 'jsx' },
    target: 'es2020',
    minify: true,
  }
}

requestPutData('key1', 'val1') //Uses author1.function1 storage. No user approval needed.
requestGetData('key1') //Uses author1.function1 storage. No user approval needed.
requestGetData('key1', 'author1.function2') //Uses author1.function2 storage. No user approval needed because the functions share an author.
requestGetData('key1', 'author2.function1') //Uses author2.function1 storage. Cross-author reads require user approval.
~~~

long

long

long

long
`;

function remarkToc() {
  return function (tree) {
    const result = toc(tree);
    tree.children = [result.map];
  };
}

mermaid.initialize({ startOnLoad: false });

function rehypeMermaid() {
  return async (tree) => {
    const nodes = [];
    visit(tree, 'element', (node) => {
      if (
        node.tagName === 'pre' &&
        node.children.length === 1 &&
        node.children[0].tagName === 'code' &&
        node.children[0].properties.className?.includes('language-mermaid')
      ) {
        nodes.push(node);
      }
    });
    const now = Date.now();
    await Promise.all(
      nodes.map(async (node, i) => {
        const { svg } = await mermaid.render(
          `mermaid-${now}-${i}`, //these need to be unique for some reason
          node.children[0].children[0].value
        );
        node.tagName = 'div';
        node.properties = { className: 'mermaid' };
        node.children = fromHtmlIsomorphic(svg, { fragment: true }).children;
      })
    );
  };
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const id = entry.target.getAttribute('id');
      if (entry.isIntersecting) {
        document
          .querySelector(`#nav a[href="#${id}"]`)
          .classList.add('font-bold');
      } else {
        document
          .querySelector(`#nav a[href="#${id}"]`)
          .classList.remove('font-bold');
      }
    });
  },
  { threshold: 0.1 }
);

function getDepth(element) {
  let depth = 0;
  while (element.parentElement) {
    element = element.parentElement;
    if (element.localName === 'ul') {
      depth++;
    }
  }
  return depth - 1;
}

function postRender() {
  requestAnimationFrame(() => {
    document.querySelectorAll('#nav a').forEach((a) => {
      a.parentElement.style.paddingLeft = `${getDepth(a) * 8}px`;
    });
    document
      .getElementById('main')
      ?.querySelectorAll('h1, h2, h3, h4, h5, h6')
      .forEach((h) => {
        observer.observe(h);
      });
  });
}

const buttonStyle =
  'grow rounded-md border border-black font-bold text-white text-sm ';

function Markdown({ processor, children }) {
  const [Content, setContent] = useState(createElement(Fragment));

  useEffect(() => {
    async function process() {
      try {
        const file = await processor.process(children);
        setContent(file.result);
      } catch (error) {
        console.error('Error processing markdown:', error);
      }
    }
    process();
  }, [processor, children]);

  useEffect(() => {
    postRender();
  }, [Content]);

  return Content;
}

const navProcessor = unified()
  .use(remarkParse)
  .use(remarkToc)
  .use(remarkRehype)
  .use(rehypeReact, {
    Fragment: prod.Fragment,
    jsx: prod.jsx,
    jsxs: prod.jsxs,
  });

const mainProcessor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeMermaid)
  .use(rehypeHighlight)
  .use(rehypeReact, {
    Fragment: prod.Fragment,
    jsx: prod.jsx,
    jsxs: prod.jsxs,
  });

function App() {
  const [markdown, setMarkdown] = useState(initMarkdown);

  async function handleChange(e) {
    setMarkdown(e.target.value);
  }

  function handlePublish() {
    const functionObj = {
      script: `
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const id = entry.target.getAttribute("id");
      if (entry.isIntersecting) {
        document
          .querySelector(\`#nav a[href="#\${id}"]\`)
          .classList.add("font-bold");
      } else {
        document
          .querySelector(\`#nav a[href="#\${id}"]\`)
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
      `,
      style: document.getElementsByTagName('style')[0].innerHTML,
      html: document.getElementById('preview').innerHTML,
    };
    console.log(functionObj);
  }

  function handleDownload() {
    console.log('download');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex w-full flex-col">
        <textarea
          className="w-full grow resize-none p-px"
          value={markdown}
          onChange={handleChange}
        ></textarea>
        <div className="flex w-full">
          <button
            className={buttonStyle + 'bg-blue-600 hover:bg-blue-700'}
            onClick={handlePublish}
          >
            Publish
          </button>
          <button
            className={buttonStyle + 'bg-stone-600 hover:bg-stone-700'}
            onClick={handleDownload}
          >
            Download
          </button>
        </div>
      </div>
      <div id="preview" className="flex h-screen w-full overflow-hidden">
        <div
          id="nav"
          className="sticky hidden w-60 overflow-y-auto border-r border-stone-500 p-1 md:block"
        >
          <Markdown processor={navProcessor}>{markdown}</Markdown>
        </div>
        <div
          id="main-container"
          className="flex grow flex-col items-center overflow-y-auto scroll-smooth px-3 py-1"
        >
          <div id="main" className="w-full max-w-screen-lg">
            <Markdown processor={mainProcessor}>{markdown}</Markdown>
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
