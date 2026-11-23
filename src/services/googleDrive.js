const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const FOLDER_NAME = 'PDF_Drive_Studio';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
let accessToken = null;
let folderId = null;

export function setGoogleAccessToken(token) {
  accessToken = token || null;
  folderId = null;
}

export function revokeGoogleAccessToken() {
  const token = accessToken;
  accessToken = null;
  folderId = null;
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token, () => {});
  }
}

export function getGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
}

export function requestGoogleAccessToken() {
  const clientId = getGoogleClientId();
  if (!clientId || clientId === 'your_google_client_id_here') {
    return Promise.reject(new Error('Add your Google OAuth client ID to .env before signing in.'));
  }

  return new Promise((resolve, reject) => {
    const requestToken = () => {
      if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services did not load. Check your connection and try again.'));
        return;
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error_description || response.error || 'Google sign-in failed.'));
            return;
          }
          resolve(response.access_token);
        },
        error_callback: (error) => reject(new Error(error?.message || 'Google sign-in was cancelled.')),
      });
      client.requestAccessToken({ prompt: 'consent' });
    };

    if (window.google?.accounts?.oauth2) {
      requestToken();
      return;
    }

    const existingScript = document.querySelector('script[data-google-identity]');
    if (existingScript) {
      if (existingScript.dataset.loadError === 'true') {
        reject(new Error('Could not load Google Identity Services.'));
        return;
      }
      existingScript.addEventListener('load', requestToken, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Could not load Google Identity Services.')), { once: true });
      window.setTimeout(() => {
        if (!window.google?.accounts?.oauth2) {
          reject(new Error('Google Identity Services did not load. Check your connection and try again.'));
        }
      }, 10_000);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = requestToken;
    script.onerror = () => {
      script.dataset.loadError = 'true';
      reject(new Error('Could not load Google Identity Services.'));
    };
    document.head.appendChild(script);
  });
}

async function driveRequest(path, options = {}) {
  if (!accessToken) throw new Error('Sign in to Google Drive first.');
  const response = await fetch(`${DRIVE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error?.message || `Google Drive request failed (${response.status}).`);
  }
  return response;
}

async function getOrCreateFolder() {
  if (folderId) return folderId;

  const query = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`);
  const response = await driveRequest(`/files?q=${query}&spaces=drive&fields=files(id,name)&pageSize=100`);
  const result = await response.json();
  if (result.files?.length) {
    folderId = result.files[0].id;
    return folderId;
  }

  const created = await driveRequest('/files?fields=id,name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  const folder = await created.json();
  folderId = folder.id;
  return folderId;
}

export async function uploadFileToDrive(file) {
  const parent = await getOrCreateFolder();
  const boundary = `pdf-drive-${crypto.randomUUID?.() || Date.now()}`;
  const metadata = JSON.stringify({ name: file.name, parents: [parent] });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ]);
  const response = await driveRequest('/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return response.json();
}

export async function listDriveFiles() {
  const parent = await getOrCreateFolder();
  const query = encodeURIComponent(`'${parent}' in parents and trashed=false`);
  const files = [];
  let pageToken = '';
  do {
    const tokenQuery = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const response = await driveRequest(`/files?q=${query}&orderBy=modifiedTime desc&pageSize=100&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink)${tokenQuery}`);
    const result = await response.json();
    files.push(...(result.files || []));
    pageToken = result.nextPageToken || '';
  } while (pageToken);
  return files;
}

export async function downloadDriveFile(file) {
  const response = await driveRequest(`/files/${encodeURIComponent(file.id)}?alt=media`);
  return response.blob();
}

export function getDrivePreviewUrl(file) {
  return file.webViewLink || `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`;
}

export async function getGoogleProfile(token) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Google profile could not be loaded.');
  return response.json();
}
