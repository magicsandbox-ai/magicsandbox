import React from "react";

function Tooltip({
  children,
  text,
  position = "top",
  className = "",
}: {
  children: React.ReactNode;
  text: string;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  let positionClass;
  if (position === "top") {
    positionClass = "tooltip-top";
  } else if (position === "bottom") {
    positionClass = "tooltip-bottom";
  } else if (position === "left") {
    positionClass = "tooltip-left";
  } else if (position === "right") {
    positionClass = "tooltip-right";
  }
  return (
    <div
      //leading-none prevents div from adding extra height
      className={`tooltip leading-none ${positionClass} ${className}`}
      data-tip={text}
    >
      {children}
    </div>
  );
}

export default Tooltip;
