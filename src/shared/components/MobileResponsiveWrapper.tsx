import React from 'react';
import { useMobileOptimization } from '../hooks/useMobileOptimization';
import { clsx } from 'clsx';

interface MobileResponsiveWrapperProps {
  children: React.ReactNode;
  mobileLayout?: 'stack' | 'scroll' | 'tabs';
  className?: string;
  showMobileMenu?: boolean;
}

/**
 * Mobile Responsive Wrapper Component
 * Automatically adjusts layout based on device type
 */
export const MobileResponsiveWrapper: React.FC<MobileResponsiveWrapperProps> = ({
  children,
  mobileLayout = 'stack',
  className,
  showMobileMenu = true,
}) => {
  const device = useMobileOptimization();

  const layoutClasses = clsx(
    'transition-all duration-300',
    {
      'flex flex-col gap-4': mobileLayout === 'stack' && device.isMobile,
      'overflow-x-auto': mobileLayout === 'scroll' && device.isMobile,
      'space-y-4': mobileLayout === 'tabs' && device.isMobile,
    },
    className
  );

  return (
    <div className={layoutClasses} data-device-type={device.deviceType}>
      {children}
    </div>
  );
};

/**
 * Mobile-only component
 */
interface MobileOnlyProps {
  children: React.ReactNode;
  className?: string;
}

export const MobileOnly: React.FC<MobileOnlyProps> = ({ children, className }) => {
  const device = useMobileOptimization();

  if (!device.isMobile) return null;

  return <div className={className}>{children}</div>;
};

/**
 * Desktop-only component
 */
interface DesktopOnlyProps {
  children: React.ReactNode;
  className?: string;
}

export const DesktopOnly: React.FC<DesktopOnlyProps> = ({ children, className }) => {
  const device = useMobileOptimization();

  if (device.isMobile) return null;

  return <div className={className}>{children}</div>;
};

/**
 * Tablet-only component
 */
interface TabletOnlyProps {
  children: React.ReactNode;
  className?: string;
}

export const TabletOnly: React.FC<TabletOnlyProps> = ({ children, className }) => {
  const device = useMobileOptimization();

  if (!device.isTablet) return null;

  return <div className={className}>{children}</div>;
};

/**
 * Responsive Grid Component
 */
interface ResponsiveGridProps {
  children: React.ReactNode;
  mobileColumns?: number;
  tabletColumns?: number;
  desktopColumns?: number;
  gap?: number;
  className?: string;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  mobileColumns = 1,
  tabletColumns = 2,
  desktopColumns = 3,
  gap = 4,
  className,
}) => {
  const device = useMobileOptimization();

  let columns = desktopColumns;
  if (device.isMobile) columns = mobileColumns;
  else if (device.isTablet) columns = tabletColumns;

  const gridClasses = clsx(
    'grid',
    {
      'grid-cols-1': columns === 1,
      'grid-cols-2': columns === 2,
      'grid-cols-3': columns === 3,
      'grid-cols-4': columns === 4,
    },
    `gap-${gap}`,
    className
  );

  return <div className={gridClasses}>{children}</div>;
};

/**
 * Responsive Flex Component
 */
interface ResponsiveFlexProps {
  children: React.ReactNode;
  mobileDirection?: 'row' | 'col';
  tabletDirection?: 'row' | 'col';
  desktopDirection?: 'row' | 'col';
  gap?: number;
  className?: string;
}

export const ResponsiveFlex: React.FC<ResponsiveFlexProps> = ({
  children,
  mobileDirection = 'col',
  tabletDirection = 'row',
  desktopDirection = 'row',
  gap = 4,
  className,
}) => {
  const device = useMobileOptimization();

  let direction = desktopDirection;
  if (device.isMobile) direction = mobileDirection;
  else if (device.isTablet) direction = tabletDirection;

  const flexClasses = clsx(
    'flex',
    {
      'flex-row': direction === 'row',
      'flex-col': direction === 'col',
    },
    `gap-${gap}`,
    className
  );

  return <div className={flexClasses}>{children}</div>;
};

/**
 * Responsive Container Component
 */
interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  maxWidth = 'lg',
  padding = 'md',
  className,
}) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full',
  };

  const paddingClasses = {
    sm: 'px-2 py-2',
    md: 'px-4 py-4',
    lg: 'px-6 py-6',
  };

  const containerClasses = clsx(
    'mx-auto w-full',
    maxWidthClasses[maxWidth],
    paddingClasses[padding],
    className
  );

  return <div className={containerClasses}>{children}</div>;
};

/**
 * Responsive Table Component
 */
interface ResponsiveTableProps {
  headers: string[];
  rows: (string | number)[][];
  className?: string;
}

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({ headers, rows, className }) => {
  const device = useMobileOptimization();

  if (device.isMobile) {
    // Card view for mobile
    return (
      <div className="space-y-4">
        {rows.map((row, idx) => (
          <div key={idx} className="bg-white rounded-lg p-4 shadow">
            {headers.map((header, headerIdx) => (
              <div key={headerIdx} className="flex justify-between py-2 border-b last:border-0">
                <span className="font-bold text-sm">{header}:</span>
                <span className="text-right">{row[headerIdx]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Table view for desktop
  return (
    <div className="overflow-x-auto">
      <table className={clsx('w-full border-collapse', className)}>
        <thead>
          <tr className="bg-gray-100 border-b-2">
            {headers.map((header, idx) => (
              <th key={idx} className="px-4 py-2 text-left font-bold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b hover:bg-gray-50">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-4 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Responsive Button Group Component
 */
interface ResponsiveButtonGroupProps {
  buttons: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' | 'danger' }[];
  className?: string;
}

export const ResponsiveButtonGroup: React.FC<ResponsiveButtonGroupProps> = ({
  buttons,
  className,
}) => {
  const device = useMobileOptimization();

  const buttonClasses = (variant: string = 'primary') => {
    const baseClasses = 'px-4 py-2 rounded-lg font-bold transition-all';
    const variantClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700',
      secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
      danger: 'bg-red-600 text-white hover:bg-red-700',
    };
    return clsx(baseClasses, variantClasses[variant as keyof typeof variantClasses]);
  };

  const containerClasses = device.isMobile
    ? 'flex flex-col gap-2'
    : 'flex gap-3';

  return (
    <div className={clsx(containerClasses, className)}>
      {buttons.map((button, idx) => (
        <button
          key={idx}
          onClick={button.onClick}
          className={clsx(
            buttonClasses(button.variant),
            device.isMobile && 'w-full'
          )}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
};

/**
 * Responsive Modal Component
 */
interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' | 'danger' }[];
}

export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  actions,
}) => {
  const device = useMobileOptimization();

  if (!isOpen) return null;

  const modalClasses = device.isMobile
    ? 'fixed inset-0 bg-black/50 flex items-end'
    : 'fixed inset-0 bg-black/50 flex items-center justify-center';

  const contentClasses = device.isMobile
    ? 'bg-white w-full rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto'
    : 'bg-white rounded-2xl p-8 max-w-md w-full';

  return (
    <div className={modalClasses}>
      <div className={contentClasses}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="mb-6">{children}</div>

        {actions && (
          <div className={device.isMobile ? 'flex flex-col gap-2' : 'flex gap-3 justify-end'}>
            {actions.map((action, idx) => (
              <button
                key={idx}
                onClick={action.onClick}
                className={clsx(
                  'px-4 py-2 rounded-lg font-bold transition-all',
                  action.variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
                  action.variant === 'secondary' && 'bg-gray-200 text-gray-800 hover:bg-gray-300',
                  action.variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
                  device.isMobile && 'w-full'
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
