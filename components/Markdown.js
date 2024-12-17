import React, {
  useState,
  useEffect,
  createElement,
  Fragment,
  memo,
  useRef,
  useLayoutEffect,
} from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeReact from 'rehype-react';
import * as prod from 'react/jsx-runtime';

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
          });
        const file = await processor.process(children);
        setContent(file.result);
      } catch (error) {
        console.error('Error processing markdown:', error);
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

export default Markdown;
