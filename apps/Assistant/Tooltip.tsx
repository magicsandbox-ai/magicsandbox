import React from "react";

function Tooltip({
  children,
  text,
  position = "top",
}: {
  children: React.ReactNode;
  text: string;
  position?: "top" | "bottom" | "left" | "right";
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
    <div className={`tooltip ${positionClass}`} data-tip={text}>
      {children}
    </div>
  );
}

export default Tooltip;
