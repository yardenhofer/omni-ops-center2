export default function OnboardingBadge({ status }) {
  const map = {
    pending:      { label: "Pending",      cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
    link_sent:    { label: "Link Sent",    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    pending_2fa:  { label: "Pending 2FA",  cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    restricted:   { label: "Restricted",   cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    completed:    { label: "Completed",    cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  };
  const { label, cls } = map[status] || { label: status || "—", cls: "bg-gray-100 text-gray-500" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}