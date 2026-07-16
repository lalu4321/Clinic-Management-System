import Modal from "./Modal";
import Button from "./Button";
import { FaExclamationTriangle } from "react-icons/fa";

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmLabel = "Confirm",
  confirmVariant = "danger",
  loading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <FaExclamationTriangle className="text-red-500 text-3xl" />
        </div>
        <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
      </div>
      <div className="flex justify-center gap-3 mt-4">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
