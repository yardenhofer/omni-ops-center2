import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Users, Linkedin } from "lucide-react";

export default function WorkspaceSwitcher() {
  const location = useLocation();
  const isInternal = location.pathname === "/InternalDashboard";

  return (
    <div className="mx-3 mb-2 flex rounded-lg bg-gray-100 dark:bg-gray-800/80 p-0.5 gap-0.5">
      <Link
        to={createPageUrl("Dashboard")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
          !isInternal
            ? "bg-white dark:bg-gray-700 text-violet-600 dark:text-violet-400 shadow-sm"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        }`}
      >
        <Users className="w-3.5 h-3.5" />
        Client
      </Link>
      <Link
        to="/InternalDashboard"
        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
          isInternal
            ? "bg-white dark:bg-gray-700 text-blue-500 dark:text-blue-400 shadow-sm"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        }`}
      >
        <Linkedin className="w-3.5 h-3.5" />
        Internal
      </Link>
    </div>
  );
}