import React from "react";
import ModalOverlay from "@components/ModalOverlay.js";

export default function Discover({ setShowDiscover }) {
  return (
    <ModalOverlay
      modal={<DiscoverInner />}
      onClose={() => {
        setShowDiscover(false);
      }}
      fullScreen={true}
    />
  );
}

function DiscoverInner() {
  return <div>Discover</div>;
}
