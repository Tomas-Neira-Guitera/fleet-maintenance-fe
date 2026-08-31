import { API_BASE_URL, throwApiError } from './apiClient';

export interface UploadedPhoto {
  photoId: string;
  photoUrl: string;
}

export async function uploadDefectPhoto(file: File): Promise<UploadedPhoto> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/api/photos`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) return throwApiError(res, 'No se pudo subir la foto');
  return res.json() as Promise<UploadedPhoto>;
}
