import React, { useState } from "react";
import { ModelPicker } from "./ModelPicker.js";
import { Menu, Search, Plus } from "lucide-react";

//menu, search, new

export default function ChatHistory({ model, setModel, assistantRef }) {
  const [show, setShow] = useState(window.innerWidth > 768);

  function handleSearch() {
    console.log("search");
  }

  if (show) {
    return (
      <div className="flex w-56 flex-col gap-2 border-r-2 border-stone-500 bg-stone-100 py-3">
        <div className="mx-3 flex justify-between">
          <button onClick={() => setShow(!show)}>
            <Menu />
          </button>
          <button onClick={() => handleSearch()}>
            <Search />
          </button>
          <button onClick={() => assistantRef.current.handleNewConversation()}>
            <Plus />
          </button>
        </div>
        <div className="mx-3">
          <ModelPicker model={model} setModel={setModel} />
        </div>
      </div>
    );
  } else {
    return (
      <button className="absolute ml-3 mt-3" onClick={() => setShow(!show)}>
        <Menu />
      </button>
    );
  }
}
