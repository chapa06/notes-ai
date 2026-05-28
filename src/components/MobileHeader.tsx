import { Sparkles, Menu, X } from "lucide-react";

interface MobileHeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function MobileHeader({ isSidebarOpen, onToggleSidebar }: MobileHeaderProps) {
  return (
    <div className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <h1 className="font-bold text-text">Voice заметки</h1>
      </div>
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg hover:bg-surface transition-colors"
      >
        {isSidebarOpen ? <X size={20} className="text-text" /> : <Menu size={20} className="text-text" />}
      </button>
    </div>
  );
}