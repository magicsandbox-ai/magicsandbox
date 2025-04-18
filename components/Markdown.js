/*
"unified": "^11.0.5",
"remark-parse": "^11.0.0",
"remark-rehype": "^11.1.0",
"rehype-sanitize": "^6.0.0",
"rehype-react": "^8.0.0",
*/

import React, {
  useState,
  useEffect,
  createElement,
  Fragment,
  memo,
  useRef,
  useLayoutEffect,
} from "react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeReact from "rehype-react";
import * as prod from "react/jsx-runtime";

//careful with memo and remarkPlugins, rehypeSanitizeOptions, rehypePlugins, onComplete

const Markdown = memo(function Markdown({
  className,
  remarkPlugins,
  rehypePlugins,
  rehypeSanitizeOptions,
  onComplete,
  children,
}) {
  const [Content, setContent] = useState(createElement(Fragment));

  const initRef = useRef(false);

  useEffect(() => {
    async function process() {
      try {
        const processor = unified()
          .use(remarkParse)
          .use(remarkPlugins || [])
          .use(remarkRehype)
          .use(rehypePlugins || [])
          .use(rehypeSanitize, rehypeSanitizeOptions)
          .use(rehypeReact, {
            Fragment: prod.Fragment,
            jsx: prod.jsx,
            jsxs: prod.jsxs,
            components: {
              pre: Pre,
            },
          });
        const file = await processor.process(children);
        setContent(file.result);
      } catch (error) {
        console.error("Error processing markdown:", error);
      }
    }
    process();
  }, [remarkPlugins, rehypePlugins, children]);

  useLayoutEffect(() => {
    if (initRef.current && onComplete) {
      onComplete();
    }
    initRef.current = true;
  }, [Content]);

  return <div className={className}>{Content}</div>;
});

function Pre({ children, ...props }) {
  const [copied, setCopied] = useState(false);
  const [isSingleLine, setIsSingleLine] = useState(false);

  const ref = useRef();

  useLayoutEffect(() => {
    if (ref.current) {
      setIsSingleLine(ref.current.offsetHeight <= 40);
    }
  }, [children]);

  const handleCopy = () => {
    const code = ref.current.innerText.trim();
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="group/code relative">
      <button
        onClick={handleCopy}
        className={`absolute right-2 rounded border border-stone-500 px-2 py-1 text-sm font-bold opacity-0 transition-opacity duration-200 hover:bg-stone-200 group-hover/code:opacity-100 ${
          isSingleLine ? "top-1" : "top-2"
        }`}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre ref={ref} {...props}>
        {children}
      </pre>
    </div>
  );
}

export default Markdown;
