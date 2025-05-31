import React from "react";

type HoverProps = {
  content: string;
  el: HTMLElement;
  x: number;
  maxWidth?: number;
  maxHeight?: number;
};

function Hover({
  content,
  el,
  x,
  maxWidth = 300,
  maxHeight = 100,
}: HoverProps) {
  if (!content) {
    return;
  }
  const { top: elTop, bottom: elBottom } = el.getBoundingClientRect();
  let style: {
    top?: number;
    bottom?: number;
    right?: number;
    left?: number;
    maxWidth?: number;
    maxHeight?: number;
  } = {
    maxWidth,
    maxHeight,
  };
  if (elTop < maxHeight + 20) {
    //20 accounts for 8px margin plus don't want to be too tight
    style.top = elBottom; //hover below el
  } else {
    style.bottom = window.innerHeight - elTop; //hover above el
  }
  if (x + maxWidth + 12 > window.innerWidth) {
    style.right = x; //hover right aligned
  } else {
    style.left = x; //hover left aligned
  }
  style = Object.fromEntries(
    Object.entries(style).map(([k, v]) => [k, `${v}px`]),
  );
  return (
    <div
      className="fixed z-50 my-2 overflow-y-auto whitespace-pre-wrap rounded border border-stone-500 bg-stone-50 p-1 font-mono text-xs shadow-md"
      style={style}
    >
      {content}
    </div>
  );
}

export { Hover, type HoverProps };
