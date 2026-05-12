export default function StatusBadge({ status }) {
  const map = {
    connected:    { label: "Connected",    cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    disconnected: { label: "Disconnected", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    in_progress:  { label: "In Progress",  cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    refreshed:    { label: "Refreshed",    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}