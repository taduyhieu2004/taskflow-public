import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { labelsApi } from '@/features/tasks/tasks-api';
import type { Label as LabelType } from '@/types/task';

const COLOR_PALETTE = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#84CC16',
  '#22C55E',
  '#10B981',
  '#14B8A6',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#A855F7',
  '#EC4899',
  '#64748B',
  '#374151',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
}

export function ManageLabelsDialog({ open, onOpenChange, projectId }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState<string>(COLOR_PALETTE[0]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const labelsQuery = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => labelsApi.list(projectId),
    enabled: open && !!projectId,
  });

  const labels = labelsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: () => labelsApi.create({ project_id: projectId, name: name.trim(), color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels', projectId] });
      setName('');
      setColor(COLOR_PALETTE[0]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      labelsApi.update(editingId!, { name: editingName.trim(), color: editingColor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels', projectId] });
      cancelEdit();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => labelsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels', projectId] });
      setConfirmDeleteId(null);
    },
  });

  function startEdit(l: LabelType) {
    setEditingId(l.id);
    setEditingName(l.name);
    setEditingColor(l.color);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName('');
    setEditingColor(COLOR_PALETTE[0]);
  }

  function handleCreate() {
    if (!name.trim()) return;
    createMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary-600" /> Quản lý nhãn
          </DialogTitle>
          <DialogDescription>
            Tạo, sửa, xoá nhãn dùng chung trong project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create form */}
          <div className="rounded-lg border border-gray-200 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Tạo nhãn mới</p>
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 text-[11px] font-semibold rounded flex-shrink-0"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {name.trim() || 'Xem trước'}
              </span>
              <input
                type="text"
                placeholder="Tên nhãn…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
                maxLength={50}
                className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={!name.trim() || createMutation.isPending}
              >
                <Plus className="w-4 h-4" /> Tạo
              </Button>
            </div>
            <ColorPicker value={color} onChange={setColor} />
            {createMutation.isError && (
              <p className="text-xs text-rose-600">{extractErrorMessage(createMutation.error)}</p>
            )}
          </div>

          {/* List */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Nhãn hiện có ({labels.length})
            </p>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
              {labelsQuery.isLoading ? (
                <p className="text-xs text-gray-400">Đang tải…</p>
              ) : labels.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Chưa có nhãn nào.</p>
              ) : (
                labels.map((l) =>
                  editingId === l.id ? (
                    <div key={l.id} className="rounded-lg border border-primary-200 bg-primary-50/40 p-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 text-[11px] font-semibold rounded flex-shrink-0"
                          style={{ backgroundColor: `${editingColor}20`, color: editingColor }}
                        >
                          {editingName.trim() || 'Xem trước'}
                        </span>
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          maxLength={50}
                          autoFocus
                          className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <button
                          onClick={() => updateMutation.mutate()}
                          disabled={!editingName.trim() || updateMutation.isPending}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50"
                          title="Lưu"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                          title="Huỷ"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <ColorPicker value={editingColor} onChange={setEditingColor} />
                    </div>
                  ) : (
                    <div
                      key={l.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition group"
                    >
                      <span
                        className="px-2 py-0.5 text-[11px] font-semibold rounded flex-shrink-0"
                        style={{ backgroundColor: `${l.color}20`, color: l.color }}
                      >
                        {l.name}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">{l.color}</span>
                      <div className="flex-1" />
                      <button
                        onClick={() => startEdit(l)}
                        className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded opacity-0 group-hover:opacity-100 transition"
                        title="Sửa"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirmDeleteId === l.id) {
                            deleteMutation.mutate(l.id);
                          } else {
                            setConfirmDeleteId(l.id);
                          }
                        }}
                        className={cn(
                          'p-1 rounded transition',
                          confirmDeleteId === l.id
                            ? 'bg-rose-500 text-white opacity-100'
                            : 'text-gray-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100',
                        )}
                        title={confirmDeleteId === l.id ? 'Xác nhận xoá?' : 'Xoá'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ),
                )
              )}
            </div>
            {updateMutation.isError && (
              <p className="text-xs text-rose-600 mt-2">{extractErrorMessage(updateMutation.error)}</p>
            )}
            {deleteMutation.isError && (
              <p className="text-xs text-rose-600 mt-2">{extractErrorMessage(deleteMutation.error)}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" size="sm">
              Đóng
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {COLOR_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            'w-5 h-5 rounded-full border transition hover:scale-110',
            value === c ? 'ring-2 ring-offset-1 ring-gray-700' : 'border-gray-200',
          )}
          style={{ backgroundColor: c }}
          aria-label={c}
        />
      ))}
    </div>
  );
}
