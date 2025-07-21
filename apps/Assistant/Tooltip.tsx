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
    positionClass = "xl:tooltip-top";
  } else if (position === "bottom") {
    positionClass = "xl:tooltip-bottom";
  } else if (position === "left") {
    positionClass = "xl:tooltip-left";
  } else if (position === "right") {
    positionClass = "xl:tooltip-right";
  }
  return (
    <div
      //leading-none prevents div from adding extra height
      className={`tooltip-color xl:tooltip leading-none ${positionClass} ${className}`}
      data-tip={text}
    >
      {children}
    </div>
  );
}

export default Tooltip;
