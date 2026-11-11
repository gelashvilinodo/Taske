'use client';

import { useState, type ReactNode } from 'react';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

/** A board column that accepts dragged task cards. */
export default function DropColumn({ className, label, onDropTask, children }: {
  className: string; label: string; onDropTask: (id: string) => void; children: ReactNode;
}) {
  const { readOnly, tasks, setDragId } = useWorkspace();
  const [over, setOver] = useState(false);
  if (readOnly) return <section className={className} aria-label={label}>{children}</section>;
  return (
    <section
      className={className + (over ? ' is-over' : '')}
      aria-label={label}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={e => {
        e.preventDefault();
        setOver(false);
        setDragId(null);
        const id = e.dataTransfer.getData('text/plain');
        if (tasks.some(t => t.id === id)) onDropTask(id);
      }}
    >
      {children}
    </section>
  );
}
