import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { projectsApi } from '@/features/projects/projects-api';
import { extractErrorMessage } from '@/lib/api';
import type { ProjectType } from '@/types/project';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function generateProjectKey(projectName: string): string {
  // Remove Vietnamese diacritics
  const withoutDiacritics = projectName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd');

  // Keep only alphanumeric and spaces
  const cleaned = withoutDiacritics.replace(/[^a-zA-Z0-9\s]/g, '');

  const words = cleaned.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  if (words.length === 1) {
    // If only one word, take the first 3 characters, uppercase
    return words[0].substring(0, 3).toUpperCase();
  }

  // If multiple words, take the first letter of each word
  return words
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 10);
}

export function CreateProjectDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ProjectType>('SOFTWARE');
  const [isKeyManuallyEdited, setIsKeyManuallyEdited] = useState(false);

  const mutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      reset();
      onOpenChange(false);
    },
  });

  function reset() {
    setName('');
    setKey('');
    setDescription('');
    setType('SOFTWARE');
    setIsKeyManuallyEdited(false);
    mutation.reset();
  }

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isKeyManuallyEdited) {
      setKey(generateProjectKey(val));
    }
  };

  const handleKeyChange = (val: string) => {
    const formatted = val.toUpperCase();
    setKey(formatted);
    setIsKeyManuallyEdited(true);
  };

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      name: name.trim(),
      key: key.trim().toUpperCase(),
      description: description.trim() || undefined,
      type,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo project mới</DialogTitle>
          <DialogDescription>Nhập thông tin project — bạn sẽ tự động trở thành Owner.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Tên project</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              maxLength={255}
              placeholder="Ví dụ: TaskFlow Mobile"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="key">Key (2–10 ký tự, chữ in hoa)</Label>
            <Input
              id="key"
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              required
              maxLength={10}
              pattern="^[A-Z][A-Z0-9]{1,9}$"
              placeholder="TFM"
              className="uppercase"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="type">Loại dự án</Label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as ProjectType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            >
              <option value="SOFTWARE">SOFTWARE (Phát triển phần mềm)</option>
              <option value="BUSINESS">BUSINESS (Doanh nghiệp/Kinh doanh)</option>
              <option value="PERSONAL">PERSONAL (Cá nhân/Học tập)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Mô tả (tuỳ chọn)</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              placeholder="Project làm gì?"
            />
          </div>

          {mutation.isError && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {extractErrorMessage(mutation.error)}
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Huỷ
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang tạo…' : 'Tạo project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
