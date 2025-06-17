import React, { useEffect, useRef } from "react";

function ModalOverlay({
  modal,
  onClose,
  fullScreen,
  autoFocus = true,
}: {
  modal: React.ReactNode;
  onClose: () => void;
  fullScreen?: boolean;
  autoFocus?: boolean;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    if (autoFocus) {
      const firstFocusableElement = modalRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (firstFocusableElement instanceof HTMLElement) {
        firstFocusableElement.focus();
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleClose() {
    if (Date.now() - mountTimeRef.current >= (navigator.webdriver ? 0 : 300)) {
      onClose();
    }
  }

  const backgroundStyle =
    "fixed inset-0 flex items-center justify-center z-40 bg-stone-100 bg-opacity-50";

  if (fullScreen) {
    return (
      <div ref={modalRef} className={backgroundStyle} onClick={handleClick}>
        <div
          className="max-h-[80%] max-w-[80%] overflow-y-auto rounded-lg border-2 border-stone-500 bg-white shadow-lg"
          role="dialog"
          aria-modal="true"
        >
          {modal}
        </div>
      </div>
    );
  } else {
    return (
      <div ref={modalRef}>
        <div className={backgroundStyle} onClick={handleClick} />
        <div role="dialog" aria-modal="true">
          {modal}
        </div>
      </div>
    );
  }
}

export default ModalOverlay;
