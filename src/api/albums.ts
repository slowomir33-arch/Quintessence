import type { Album, Photo } from '@/types';

// ============================================
// API CONFIGURATION
// ============================================

const DEFAULT_API_URL = (() => {
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalhost ? 'http://localhost:3001' : 'https://backend.lenaparty.pl';
  }
  return 'https://backend.lenaparty.pl';
})();

const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

// ============================================
// HELPER FUNCTIONS
// ============================================

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Błąd połączenia z serwerem' }));
    throw new Error(error.error || `HTTP Error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// ALBUMS API
// ============================================

/**
 * Get all albums
 */
export async function getAlbums(): Promise<Album[]> {
  return fetchAPI<Album[]>('/api/albums');
}

/**
 * Get single album by ID
 */
export async function getAlbumById(id: string): Promise<Album> {
  return fetchAPI<Album>(`/api/albums/${id}`);
}

/**
 * Create new album
 */
export async function createAlbum(name: string): Promise<Album> {
  return fetchAPI<Album>('/api/albums', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

/**
 * Update album
 */
export async function updateAlbum(id: string, name: string): Promise<Album> {
  return fetchAPI<Album>(`/api/albums/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

/**
 * Delete album
 */
export async function deleteAlbum(id: string): Promise<{ message: string; id: string }> {
  return fetchAPI(`/api/albums/${id}`, {
    method: 'DELETE',
  });
}

// ============================================
// PHOTOS API
// ============================================

/**
 * Upload photos to existing album
 */
export async function uploadPhotosToAlbum(
  albumId: string,
  files: File[],
  onProgress?: (progress: number) => void
): Promise<{ message: string; photos: Photo[] }> {
  const formData = new FormData();
  
  files.forEach((file) => {
    formData.append('photos', file);
  });

  // Using XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.open('POST', `${API_BASE_URL}/api/albums/${albumId}/photos`);
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    };
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error || 'Upload failed'));
        } catch {
          reject(new Error('Upload failed'));
        }
      }
    };
    
    xhr.onerror = () => reject(new Error('Network error'));
    
    xhr.send(formData);
  });
}

/**
 * Delete photo from album
 */
export async function deletePhoto(
  albumId: string,
  photoId: string
): Promise<{ message: string; id: string }> {
  return fetchAPI(`/api/albums/${albumId}/photos/${photoId}`, {
    method: 'DELETE',
  });
}

// ============================================
// BULK UPLOAD (Create album + upload photos)
// ============================================

const BATCH_SIZE = 5; // Upload 5 files at a time (for large files like 50MB each)
const UPLOAD_TIMEOUT = 600000; // 10 minutes timeout per batch

interface UploadedFile {
  file: File;
  relativePath: string; // np. "light/plik.jpg" lub "max/plik.jpg"
}

/**
 * Upload a single batch of files
 */
async function uploadBatch(
  url: string,
  formData: FormData,
  onProgress?: (loaded: number, total: number) => void
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.open('POST', url);
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded, event.total);
      }
    };
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error || 'Upload failed'));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    };
    
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.ontimeout = () => reject(new Error('Upload timeout - plik za duży lub wolne połączenie'));
    
    xhr.timeout = UPLOAD_TIMEOUT;
    xhr.send(formData);
  });
}

/**
 * Append file to FormData with custom filename that includes relative path
 * This preserves light/max folder structure for backend to parse
 */
function appendFileWithPath(formData: FormData, uploadedFile: UploadedFile): void {
  // Wysyłamy plik z nazwą zawierającą ścieżkę względną
  // np. "light/plik.jpg" lub "max/plik.jpg" lub "18_Leny!__light_2025-11-08___57A8703.jpg"
  formData.append('photos', uploadedFile.file, uploadedFile.relativePath);
}

/**
 * Upload entire album (creates album + uploads all photos in batches)
 * Files should include relativePath for light/max folder structure
 */
export async function uploadAlbum(
  albumName: string,
  files: UploadedFile[],
  onProgress?: (progress: number) => void
): Promise<{ message: string; album: Album }> {
  
  // If small number of files, upload directly
  if (files.length <= BATCH_SIZE) {
    const formData = new FormData();
    formData.append('albumName', albumName);
    files.forEach((f) => appendFileWithPath(formData, f));
    
    const result = await uploadBatch(
      `${API_BASE_URL}/api/upload`,
      formData,
      (loaded, total) => onProgress?.(loaded / total * 100)
    );
    return result as { message: string; album: Album };
  }
  
  // For large uploads, use batch upload
  console.log(`📦 Batch upload: ${files.length} files in batches of ${BATCH_SIZE}`);
  
  // Step 1: Create album with first batch
  const firstBatch = files.slice(0, BATCH_SIZE);
  const formData = new FormData();
  formData.append('albumName', albumName);
  firstBatch.forEach((f) => appendFileWithPath(formData, f));
  
  let totalUploaded = 0;
  const totalFiles = files.length;
  
  const createResult = await uploadBatch(
    `${API_BASE_URL}/api/upload`,
    formData,
    (loaded, total) => {
      const batchProgress = loaded / total;
      const overallProgress = (totalUploaded + batchProgress * firstBatch.length) / totalFiles * 100;
      onProgress?.(overallProgress);
    }
  ) as { message: string; album: Album };
  
  totalUploaded += firstBatch.length;
  onProgress?.((totalUploaded / totalFiles) * 100);
  
  const albumId = createResult.album.id;
  
  // Step 2: Upload remaining files in batches
  const remainingFiles = files.slice(BATCH_SIZE);
  
  for (let i = 0; i < remainingFiles.length; i += BATCH_SIZE) {
    const batch = remainingFiles.slice(i, i + BATCH_SIZE);
    const batchFormData = new FormData();
    batch.forEach((f) => appendFileWithPath(batchFormData, f));
    
    await uploadBatch(
      `${API_BASE_URL}/api/albums/${albumId}/photos`,
      batchFormData,
      (loaded, total) => {
        const batchProgress = loaded / total;
        const overallProgress = (totalUploaded + batchProgress * batch.length) / totalFiles * 100;
        onProgress?.(overallProgress);
      }
    );
    
    totalUploaded += batch.length;
    onProgress?.((totalUploaded / totalFiles) * 100);
    
    console.log(`✅ Batch ${Math.ceil((i + BATCH_SIZE) / BATCH_SIZE) + 1}: ${totalUploaded}/${totalFiles} files`);
  }
  
  // Fetch final album state
  const finalAlbum = await getAlbumById(albumId);
  
  return {
    message: `Album "${albumName}" utworzony z ${finalAlbum.photos.length} zdjęciami`,
    album: finalAlbum,
  };
}

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Check if backend is available
 */
export async function checkHealth(): Promise<boolean> {
  try {
    await fetchAPI('/api/health');
    return true;
  } catch {
    return false;
  }
}

// ============================================
// URL HELPERS
// ============================================

/**
 * Get full URL for image src
 */
export function getImageUrl(src: string): string {
  if (src.startsWith('http')) {
    return src;
  }
  return `${API_BASE_URL}${src}`;
}

/**
 * Get full URL for thumbnail
 */
export function getThumbnailUrl(thumbnail: string): string {
  if (thumbnail.startsWith('http')) {
    return thumbnail;
  }
  return `${API_BASE_URL}${thumbnail}`;
}

/**
 * Get download URL for album
 */
export function getAlbumDownloadUrl(albumId: string): string {
  return `${API_BASE_URL}/api/albums/${albumId}/download`;
}

/**
 * Helper to fetch blob with progress tracking
 */
async function fetchBlobWithProgress(
  url: string, 
  options: RequestInit, 
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  if (!onProgress || !response.body) {
    return response.blob();
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let loaded = 0;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      if (value) {
        chunks.push(value);
        loaded += value.length;
        if (total) {
          onProgress((loaded / total) * 100);
        }
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }
    throw new Error('Download interrupted');
  }

  return new Blob(chunks);
}

/**
 * Download single album as blob (for progress tracking)
 */
export async function downloadAlbumBlob(
  albumId: string, 
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  return fetchBlobWithProgress(
    `${API_BASE_URL}/api/albums/${albumId}/download`,
    { method: 'GET', signal },
    onProgress
  );
}

/**
 * Download multiple albums - returns blob URL
 */
export async function downloadMultipleAlbumsFromBackend(
  albumIds: string[],
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  return fetchBlobWithProgress(
    `${API_BASE_URL}/api/download-multiple`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumIds }),
      signal,
    },
    onProgress
  );
}
