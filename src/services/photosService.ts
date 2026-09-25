import { API_BASE_URL, ApiError, authHeaders, throwApiError } from './apiClient';

/** Formatos que acepta POST /api/photos. Va en el `accept` de los <input type="file">
 *  para que el selector de archivos solo ofrezca estos. */
export const ACCEPTED_PHOTO_TYPES = 'image/jpeg,image/png';

export interface UploadedPhoto {
  photoId: string;
  photoUrl: string;
}

export async function uploadDefectPhoto(file: File): Promise<UploadedPhoto> {
  // Se valida antes de subir para dar un mensaje claro sin esperar al servidor.
  if (!ACCEPTED_PHOTO_TYPES.split(',').includes(file.type)) {
    const received = file.type.includes('/')
      ? file.type.slice(file.type.indexOf('/') + 1).split('+')[0].toUpperCase()
      : 'de un formato que no reconocemos';
    throw new ApiError(415, `La foto tiene que ser JPG o PNG. El archivo que elegiste es ${received}.`, 'UNSUPPORTED_MEDIA_TYPE');
  }

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/api/photos`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (!res.ok) return throwApiError(res, 'No se pudo subir la foto');
  return res.json() as Promise<UploadedPhoto>;
}
