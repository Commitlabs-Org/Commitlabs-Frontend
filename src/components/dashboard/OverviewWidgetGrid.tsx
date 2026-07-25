"use client";

import React, { useCallback, useRef } from "react";
import { GripVertical, Eye, EyeOff } from "lucide-react";

export interface WidgetConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

interface OverviewWidgetGridProps {
  widgets: WidgetConfig[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggleVisibility: (id: string) => void;
  onReset: () => void;
  children: (id: string) => React.ReactNode;
}

export function OverviewWidgetGrid({
  widgets,
  onReorder,
  onToggleVisibility,
  onReset,
  children,
}: OverviewWidgetGridProps) {
  const dragIndex = useRef<number | null>(null);
  const sorted = [...widgets].sort((a, b) => a.order - b.order);

  const handleDragStart = useCallback((index: number) => {
    dragIndex.current = index;
  }, []);

  const handleDrop = useCallback(
    (index: number) => {
      if (dragIndex.current !== null && dragIndex.current !== index) {
        onReorder(dragIndex.current, index);
      }
      dragIndex.current = null;
    },
    [onReorder]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === "ArrowUp" && index > 0) {
        e.preventDefault();
        onReorder(index, index - 1);
      } else if (e.key === "ArrowDown" && index < sorted.length - 1) {
        e.preventDefault();
        onReorder(index, index + 1);
      }
    },
    [onReorder, sorted.length]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          Overview Widgets
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500"
            aria-label="Reset widget layout to default"
          >
            Reset to default
          </button>
        </div>
      </div>

      <div
        role="list"
        aria-label="Overview widgets, use arrow keys to reorder"
        aria-live="polite"
        className="flex flex-col gap-3"
      >
        {sorted.map((widget, index) => (
          <div
            key={widget.id}
            role="listitem"
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(index)}
            className="group relative"
          >
            <div className="flex items-center gap-2 mb-1">
              <button
                tabIndex={0}
                onKeyDown={(e) => handleKeyDown(e, index)}
                aria-label={`Reorder ${widget.label} widget, use arrow keys to move`}
                className="cursor-grab text-zinc-600 hover:text-zinc-300 focus:outline-none focus:text-zinc-300 focus:ring-2 focus:ring-zinc-500 rounded p-1 transition-colors"
                aria-grabbed={false}
              >
                <GripVertical size={16} />
              </button>
              <span className="text-xs font-medium text-zinc-500 flex-1">
                {widget.label}
              </span>
              <button
                onClick={() => onToggleVisibility(widget.id)}
                aria-label={widget.visible ? `Hide ${widget.label} widget` : `Show ${widget.label} widget`}
                aria-pressed={widget.visible}
                className="text-zinc-600 hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-500 rounded p-1 transition-colors"
              >
                {widget.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
            {widget.visible && (
              <div className="w-full">{children(widget.id)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
