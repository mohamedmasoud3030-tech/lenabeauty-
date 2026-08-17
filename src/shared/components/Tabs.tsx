import { ReactNode, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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
  /** Accessible name for this set when more than one tab list is on a page. */
  ariaLabel?: string;
}

export function Tabs({
  tabs,
  defaultValue,
  onChange,
  variant = 'default',
  ariaLabel,
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue || tabs[0]?.value || '');
  const instanceId = useId().replace(/:/g, '');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    onChange?.(value);
  };

  const activeTabIndex = Math.max(0, tabs.findIndex((tab) => tab.value === activeTab));
  const activeTabContent = tabs.find((tab) => tab.value === activeTab)?.content;

  const moveFocus = (index: number) => {
    if (tabs.length === 0) return;
    const normalized = (index + tabs.length) % tabs.length;
    handleTabChange(tabs[normalized].value);
    tabRefs.current[normalized]?.focus();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const isRtl = document.documentElement.dir === 'rtl';
    if (event.key === 'Home') {
      event.preventDefault();
      moveFocus(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveFocus(tabs.length - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveFocus(index + (isRtl ? -1 : 1));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveFocus(index + (isRtl ? 1 : -1));
    }
  };

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className={`flex gap-2 overflow-x-auto border-b border-border pb-4 ${
          variant === 'pills' ? 'bg-muted/30 rounded-xl p-1' : ''
        }`}
      >
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.value;
          const tabId = `tab-${instanceId}-${index}`;
          const panelId = `tabpanel-${instanceId}-${index}`;
          return (
            <button
              ref={(node) => { tabRefs.current[index] = node; }}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`relative min-h-11 shrink-0 px-4 py-3 font-bold text-sm flex items-center gap-2 transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              } ${variant === 'pills' ? 'rounded-lg' : ''}`}
            >
              {tab.icon && <span aria-hidden="true" className="h-5 w-5">{tab.icon}</span>}
              <span>{tab.label}</span>
              {isActive && variant === 'default' && (
                <motion.span
                  aria-hidden="true"
                  layoutId={`underline-${instanceId}`}
                  className="absolute bottom-0 inset-x-0 h-1 bg-primary rounded-full"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              {isActive && variant === 'pills' && (
                <motion.span
                  aria-hidden="true"
                  layoutId={`pill-bg-${instanceId}`}
                  className="absolute inset-0 bg-primary/10 rounded-lg -z-10"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {activeTabContent && (
        <motion.div
          key={activeTab}
          id={`tabpanel-${instanceId}-${activeTabIndex}`}
          role="tabpanel"
          aria-labelledby={`tab-${instanceId}-${activeTabIndex}`}
          tabIndex={0}
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
