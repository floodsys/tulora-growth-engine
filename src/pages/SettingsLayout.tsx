import { Outlet, useNavigate } from "react-router-dom";
import { SettingsSidebar } from "@/components/SettingsSidebar";

export default function SettingsLayout() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <SettingsSidebar onBack={handleBack} />
        <main className="flex-1">
          <div className="container mx-auto px-4 py-8 max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}