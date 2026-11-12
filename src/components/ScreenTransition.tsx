import React from 'react';

interface ScreenTransitionProps {
  screenKey: string;
  children: React.ReactNode;
}

export const ScreenTransition: React.FC<ScreenTransitionProps> = ({
  screenKey,
  children,
}) => {
  return (
    <div
      key={screenKey}
      className="w-full flex-1 flex flex-col min-h-full transition-all duration-200 ease-out"
    >
      {children}
    </div>
  );
};
