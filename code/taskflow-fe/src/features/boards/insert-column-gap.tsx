import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  onSubmit: (name: string) => void;
  isPending?: boolean;
}

export function InsertColumnGap({ onSubmit, isPending }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setName('');
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="self-start w-60 bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
          placeholder="Tên cột mới…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') {
              setEditing(false);
              setName('');
            }
          }}
          disabled={isPending}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || isPending}
            className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isPending ? 'Đang tạo…' : 'Chèn'}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setName('');
            }}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Huỷ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/gap relative flex items-center justify-center h-full w-3 flex-shrink-0">
      <button
        onClick={() => setEditing(true)}
        title="Chèn cột tại đây"
        className={cn(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10',
          'w-6 h-6 rounded-full bg-white border border-gray-300 shadow-sm text-gray-400',
          'opacity-0 group-hover/gap:opacity-100 hover:opacity-100 hover:text-primary-600 hover:border-primary-400 hover:scale-110',
          'transition flex items-center justify-center',
        )}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
