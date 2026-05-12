import { Outlet } from "react-router-dom";
import SalesNavSidebar from "./SalesNavSidebar";
import { WorkspaceProvider } from "@/context/SalesNavWorkspaceContext";

export default function SalesNavLayout() {
  return (
    <WorkspaceProvider>
      <div className="flex h-screen overflow-hidden">
        <SalesNavSidebar />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="max-w-screen-2xl mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </WorkspaceProvider>
  );
}