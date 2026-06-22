import { ReactNode, useState } from 'react';
import { motion } from 'motion/react';

interface TabItem {
  label: string;
  value: string;
  content?: ReactNode;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  variant?: 'default' | 'pills';
}

export function Tabs({
  tabs,
  defaultValue,
  onChange,
  variant = 'default',
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue || tabs[0]?.value || '');

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    onChange?.(value);
  };

  const activeTabIndex = tabs.findIndex((t) => t.value === activeTab);
  const activeTabContent = tabs.find((t) => t.value === activeTab)?.content;

  return (
    <div className="w-full">
      <div
        className={`flex gap-2 border-b border-border pb-4 ${
          variant === 'pills' ? 'bg-muted/30 rounded-xl p-1' : ''
        }`}
      >
        {tabs.map((tab, idx) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`relative px-4 py-3 font-bold text-sm flex items-center gap-2 transition-colors ${
              activeTab === tab.value
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            } ${
              variant === 'pills'
                ? 'rounded-lg'
                : ''
            }`}
          >
            {tab.icon && <span className="h-5 w-5">{tab.icon}</span>}
            <span>{tab.label}</span>
            {activeTab === tab.value && variant === 'default' && (
              <motion.div
                layoutId="underline"
                className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            {activeTab === tab.value && variant === 'pills' && (
              <motion.div
                layoutId="pill-bg"
                className="absolute inset-0 bg-primary/10 rounded-lg -z-10"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {activeTabContent && (
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="mt-6"
        >
          {activeTabContent}
        </motion.div>
      )}
    </div>
  );
}
