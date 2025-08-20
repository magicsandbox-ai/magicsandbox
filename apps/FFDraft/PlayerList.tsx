import React from "react";

interface PlayerListProps<T = any> {
  players: T[];
  leftContent?: (item: T) => React.ReactNode;
  middleContent?: (item: T) => React.ReactNode;
  rightContent?: (item: T) => React.ReactNode;
  onPlayerClick?: (item: T) => void;
  isClickable?: (item: T) => boolean;
  emptyState?: React.ReactNode;
  className?: (item: T) => string;
}

function PlayerList<T = any>({
  players,
  leftContent,
  middleContent,
  rightContent,
  onPlayerClick,
  isClickable,
  emptyState,
  className,
}: PlayerListProps<T>) {
  if (players.length === 0 && emptyState) {
    return <div className={`flex-1 overflow-auto`}>{emptyState}</div>;
  }

  return (
    <div className={`flex-1 overflow-auto`}>
      <div className="divide-y divide-gray-200">
        {players.map((item, index) => {
          const clickable = isClickable
            ? isClickable(item) && !!onPlayerClick
            : !!onPlayerClick;

          return (
            <div
              key={index}
              className={`px-4 py-2 transition-colors duration-150 ${
                clickable ? "cursor-pointer hover:bg-gray-50" : ""
              } ${className ? className(item) : ""}`}
              onClick={clickable ? () => onPlayerClick?.(item) : undefined}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {leftContent && leftContent(item)}
                  {middleContent && (
                    <div className="min-w-0 flex-1">{middleContent(item)}</div>
                  )}
                </div>
                {rightContent && (
                  <div className="ml-4">{rightContent(item)}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlayerList;
