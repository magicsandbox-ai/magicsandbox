type ToastType = "success" | "info" | "infoDark" | "warning" | "error";

class ToastError extends Error {
  type: ToastType;

  constructor(message: string, type: ToastType) {
    super(message);
    this.name = "ToastError";
    this.type = type;
  }
}

export { ToastError, type ToastType };
