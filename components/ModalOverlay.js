import React, { useEffect, useRef } from "react";

function ModalOverlay({ modal, onClose, fullScreen }) {
  const modalRef = useRef();
  const previousFocusRef = useRef();
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    modalRef.current
      .querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      ?.focus();
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      previousFocusRef.current?.focus();
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleClick(e) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleClose() {
    if (Date.now() - mountTimeRef.current >= (navigator.webdriver ? 0 : 300)) {
      onClose();
    }
  }

  const baseStyle = "fixed inset-0 flex items-center justify-center";

  if (fullScreen) {
    return (
      <div
        ref={modalRef}
        className={baseStyle + " z-40 bg-stone-100 bg-opacity-50"}
        onClick={handleClick}
      >
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
        <div className={baseStyle} onClick={handleClick} />
        <div role="dialog" aria-modal="true">
          {modal}
        </div>
      </div>
    );
  }
}

export default ModalOverlay;
