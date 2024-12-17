import React from 'react';

function ModalOverlay({ modal, onClose, fullScreen }) {
  const handleClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  const baseStyle = 'fixed inset-0 flex items-center justify-center';
  if (fullScreen) {
    return (
      <div
        className={baseStyle + ' z-40 bg-stone-100 bg-opacity-50'}
        onClick={handleClick}
      >
        <div className="rounded-lg border-2 border-stone-500 bg-white shadow-lg">
          {modal}
        </div>
      </div>
    );
  } else {
    return (
      <>
        <div className={baseStyle} onClick={handleClick} />
        {modal}
      </>
    );
  }
}

export default ModalOverlay;
