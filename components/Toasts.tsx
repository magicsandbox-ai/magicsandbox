import React, {
  useState,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";

type ToastType = "success" | "info" | "infoDark" | "warning" | "error";

interface ToastsRef {
  addToast: (message: string, type: ToastType) => void;
}

const Toast = ({
  message,
  type,
  visible,
  onClose,
}: {
  message: string;
  type: ToastType;
  visible: boolean;
  onClose: () => void;
}) => {
  const toastStyles = {
    success: "bg-green-500 text-white",
    info: "bg-stone-50 text-stone-700 border border-stone-500",
    infoDark: "bg-stone-700 text-white",
    warning: "bg-yellow-500 text-black",
    error: "bg-red-500 text-white",
  };

  return (
    <div
      className={`${toastStyles[type]} rounded-md p-2 text-sm font-bold shadow-lg transition-opacity duration-500 ease-out ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:font-bold">
        X
      </button>
    </div>
  );
};

const Toasts = forwardRef<ToastsRef, { className: string }>(function Toasts(
  { className },
  ref,
) {
  const [toasts, setToasts] = useState<
    { id: number; message: string; type: ToastType; visible: boolean }[]
  >([]);
  const toastIdRef = useRef(0);

  useImperativeHandle(ref, () => {
    return {
      addToast,
    };
  }, []);

  const addToast = (message: string, type: ToastType) => {
    const id = toastIdRef.current++;
    setToasts((prevToasts) => [
      ...prevToasts,
      { id, message, type, visible: true },
    ]);
    //duration depends on how many toasts there are, to give user a chance to read
    const duration = 4000 + toasts.length * 2000;
    setTimeout(() => fadeToast(id), duration);
  };

  const fadeToast = (id: number) => {
    setToasts((prevToasts) =>
      prevToasts.map((toast) =>
        toast.id === id ? { ...toast, visible: false } : toast,
      ),
    );
    setTimeout(() => removeToast(id), 500);
  };

  const removeToast = (id: number) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  };

  return (
    <div className={`${className} fixed right-4 z-50 flex flex-col space-y-2`}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          visible={toast.visible}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
});

class ToastError extends Error {
  type: ToastType;

  constructor(message: string, type: ToastType) {
    super(message);
    this.name = "ToastError";
    this.type = type;
  }
}

export { Toasts, ToastError };
export type { ToastsRef };
