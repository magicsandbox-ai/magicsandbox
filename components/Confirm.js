import React from 'react';
import ModalOverlay from './ModalOverlay.js';

function InnerConfirm({ onClose, header, message, buttons, customContent }) {
  function handleClick(onClick) {
    if (onClick) {
      onClick();
    }
    onClose();
  }
  return (
    <div className="flex flex-col gap-4 p-4">
      {header && <h2 className="text-lg font-bold">{header}</h2>}
      {message && <p>{message}</p>}
      {customContent}
      <div className="flex justify-center gap-4">
        {buttons.map((b, i) => (
          <button
            key={i}
            className={'rounded px-4 py-2 font-bold ' + b.className}
            onClick={() => {
              handleClick(b.onClick);
            }}
          >
            {b.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Confirm({ onClose, header, message, buttons, customContent }) {
  return (
    <ModalOverlay
      modal={
        <InnerConfirm
          {...{ onClose, header, message, buttons, customContent }}
        />
      }
      onClose={onClose}
      fullScreen={true}
    />
  );
}

export default Confirm;
