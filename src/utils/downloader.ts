import { saveAs } from 'file-saver';
import type { Album } from '@/types';
import { downloadAlbumBlob, downloadMultipleAlbumsFromBackend } from '@/api/albums';

/**
 * Downloads a single album as ZIP from backend
 */
export async function downloadAlbum(album: Album): Promise<void> {
  // Use fetch to allow loading state in UI
  const blob = await downloadAlbumBlob(album.id);
  saveAs(blob, `Lena ${album.name}.zip`);
}

/**
 * Downloads multiple albums as a single ZIP from backend
 */
export async function downloadMultipleAlbums(albums: Album[]): Promise<void> {
  const albumIds = albums.map(a => a.id);
  const blob = await downloadMultipleAlbumsFromBackend(albumIds);
  
  const filename = albums.length === 1 
    ? `Lena ${albums[0].name}.zip`
    : 'Lena Galeria.zip';
  
  saveAs(blob, filename);
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
