import { saveAs } from 'file-saver';
import type { Album } from '@/types';
import { getAlbumDownloadUrl, downloadMultipleAlbumsFromBackend } from '@/api/albums';

/**
 * Downloads a single album as ZIP from backend
 */
export async function downloadAlbum(album: Album): Promise<void> {
  const downloadUrl = getAlbumDownloadUrl(album.id);
  
  // Trigger download via hidden link
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `Lena ${album.name}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
