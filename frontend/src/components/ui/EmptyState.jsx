import { FaInbox } from "react-icons/fa";

export default function EmptyState({ message = "No data found.", icon: Icon = FaInbox, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
      <Icon className="text-5xl" />
      <p className="text-sm">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
