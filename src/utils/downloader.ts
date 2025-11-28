import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Photo, Album } from '@/types';

/**
 * Downloads all photos from an album as a ZIP file
 * Uses JSZip for client-side ZIP creation
 */
export async function downloadAlbumAsZip(
  photos: Photo[],
  albumName: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(albumName);
  
  if (!folder) {
    throw new Error('Failed to create ZIP folder');
  }

  const totalPhotos = photos.length;
  let loadedPhotos = 0;

  // Fetch and add each photo to the ZIP
  const fetchPromises = photos.map(async (photo, index) => {
    try {
      const response = await fetch(photo.src, {
        mode: 'cors',
        credentials: 'omit',
      });
      
      if (!response.ok) {
        console.warn(`Failed to fetch photo: ${photo.src}, status: ${response.status}`);
        return;
      }
      
      const blob = await response.blob();
      
      if (blob.size === 0) {
        console.warn(`Empty blob for photo: ${photo.src}`);
        return;
      }
      
      // Extract filename from URL or use index
      const urlParts = photo.src.split('/');
      let filename = urlParts[urlParts.length - 1];
      
      // If filename doesn't have extension, add one based on blob type
      if (!filename.includes('.')) {
        const extension = blob.type.split('/')[1] || 'jpg';
        filename = `photo_${index + 1}.${extension}`;
      }
      
      // Clean filename
      filename = filename.split('?')[0]; // Remove query params
      
      folder.file(filename, blob);
      
      loadedPhotos++;
      if (onProgress) {
        onProgress((loadedPhotos / totalPhotos) * 100);
      }
    } catch (error) {
      console.error(`Error fetching photo ${photo.src}:`, error);
    }
  });

  await Promise.all(fetchPromises);

  // Generate the ZIP file
  const content = await zip.generateAsync(
    { type: 'blob' },
    (metadata) => {
      if (onProgress) {
        // The second half of progress is ZIP generation
        onProgress(50 + (metadata.percent / 2));
      }
    }
  );

  // Sanitize album name for filename
  const safeFilename = albumName
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
  
  // Trigger download
  saveAs(content, `${safeFilename}.zip`);
}

/**
 * Downloads a single photo
 */
export async function downloadPhoto(photo: Photo): Promise<void> {
  try {
    const response = await fetch(photo.src);
    const blob = await response.blob();
    
    const urlParts = photo.src.split('/');
    let filename = urlParts[urlParts.length - 1].split('?')[0];
    
    if (!filename.includes('.')) {
      const extension = blob.type.split('/')[1] || 'jpg';
      filename = `photo.${extension}`;
    }
    
    saveAs(blob, filename);
  } catch (error) {
    console.error('Error downloading photo:', error);
    throw error;
  }
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

/**
 * Downloads a single album as ZIP
 */
export async function downloadAlbum(album: Album): Promise<void> {
  console.log('Downloading album:', album.name, 'with', album.photos.length, 'photos');
  await downloadAlbumAsZip(album.photos, album.name);
}

/**
 * Downloads multiple albums as a single ZIP
 */
export async function downloadMultipleAlbums(albums: Album[]): Promise<void> {
  const zip = new JSZip();
  let totalAdded = 0;

  for (const album of albums) {
    const folder = zip.folder(album.name);
    if (!folder) continue;

    for (const photo of album.photos) {
      try {
        console.log('Fetching:', photo.src);
        const response = await fetch(photo.src, {
          mode: 'cors',
          credentials: 'omit',
        });
        
        if (!response.ok) {
          console.warn(`Failed: ${photo.src} - ${response.status}`);
          continue;
        }
        
        const blob = await response.blob();
        console.log('Blob size:', blob.size, 'type:', blob.type);
        
        if (blob.size === 0) {
          console.warn('Empty blob:', photo.src);
          continue;
        }
        
        const urlParts = photo.src.split('/');
        let filename = urlParts[urlParts.length - 1].split('?')[0];
        if (!filename.includes('.')) {
          filename = `photo_${totalAdded + 1}.jpg`;
        }
        
        folder.file(filename, blob);
        totalAdded++;
      } catch (e) {
        console.error(`Error fetching ${photo.src}:`, e);
      }
    }
  }

  console.log('Total photos added to ZIP:', totalAdded);
  
  if (totalAdded === 0) {
    throw new Error('Nie udało się pobrać żadnych zdjęć');
  }

  const content = await zip.generateAsync({ type: 'blob' });
  console.log('ZIP size:', content.size);
  saveAs(content, 'galeria.zip');
}
