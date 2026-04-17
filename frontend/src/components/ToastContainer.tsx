'use client';

interface ToastContainerProps {
  toasts?: string[];
}

export default function ToastContainer({ toasts = [] }: ToastContainerProps) {
  return (
    <div id="toast-container">
      {toasts.map((toast, index) => (
        <div key={index} className="toast">
          {toast}
        </div>
      ))}
    </div>
  );
}
