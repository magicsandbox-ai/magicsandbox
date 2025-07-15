import React from "react";

interface DivButtonProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "onClick" | "onKeyDown" | "role" | "tabIndex"
  > {
  children: React.ReactNode;
  onPress: (
    e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
  ) => void;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * A div that behaves like a button. Use this only when you can't use a button (e.g. if you need to nest buttons, which is invalid HTML)
 */
function DivButton({
  children,
  onPress,
  ref,
  className,
  ...props
}: DivButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      e.target instanceof HTMLElement &&
      e.target.tagName !== "BUTTON" &&
      !e.target.closest("button")
    ) {
      onPress(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      e.target instanceof HTMLElement &&
      e.target.tagName !== "BUTTON" &&
      !e.target.closest("button") &&
      (e.key === "Enter" || e.key === " ")
    ) {
      e.preventDefault();
      onPress(e);
    }
  };

  return (
    <div
      ref={ref}
      className={`cursor-pointer ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      {...props}
    >
      {children}
    </div>
  );
}

export default DivButton;
