import { api, unwrap } from '@/lib/api';
import type { ApiResponse, PageResponse } from '@/types/api';
import type { Attachment } from '@/types/collab';

export const attachmentsApi = {
  list: (taskId: number) =>
    api
      .get<ApiResponse<PageResponse<Attachment> | Attachment[]>>(`/tasks/${taskId}/attachments`, {
        params: { page: 0, size: 100 },
      })
      .then((res) => {
        const d = res.data.data;
        return Array.isArray(d) ? d : d.content;
      }),

  upload: (taskId: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post<ApiResponse<Attachment>>(`/tasks/${taskId}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(unwrap);
  },

  remove: (id: number) =>
    api.delete<ApiResponse<void>>(`/attachments/${id}`).then(unwrap),

  /**
   * Tải file qua axios (kèm header Authorization). Trả blob + tên file lấy
   * từ header Content-Disposition (UTF-8 RFC 5987), fallback về fallbackName.
   */
  download: async (id: number, fallbackName: string) => {
    const res = await api.get<Blob>(`/attachments/${id}/download`, {
      responseType: 'blob',
    });
    const fileName = parseFilenameFromDisposition(
      res.headers['content-disposition'] as string | undefined,
    ) ?? fallbackName;
    return { blob: res.data, fileName };
  },
};

/**
 * Parse `Content-Disposition: attachment; filename="..."` hoặc
 * `filename*=UTF-8''...` (RFC 5987 — ưu tiên nếu có để giữ ký tự Unicode).
 */
function parseFilenameFromDisposition(header?: string): string | null {
  if (!header) return null;
  // RFC 5987 form: filename*=UTF-8''<percent-encoded>
  const utf8Match = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (utf8Match) {
    try { return decodeURIComponent(utf8Match[1].trim()); } catch { /* fall through */ }
  }
  // Fallback: filename="..."
  const asciiMatch = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return asciiMatch ? asciiMatch[1].trim() : null;
}
