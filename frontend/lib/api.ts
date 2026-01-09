// API Client for NEXT PDF Backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
  message?: string;
  meta?: {
    current_page: number;
    per_page: number;
    total_pages: number;
    total_count: number;
  };
}

class ApiClient {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  getAccessToken(): string | null {
    if (this.accessToken) return this.accessToken;
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token');
    }
    return this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getAccessToken();
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      if (response.status === 204) {
        return {} as ApiResponse<T>;
      }

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || { code: 'UNKNOWN_ERROR', message: 'An error occurred' } };
      }

      return data;
    } catch (error) {
      return {
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error occurred',
        },
      };
    }
  }

  // Auth endpoints
  async register(email: string, password: string, fullName: string) {
    return this.request<{ id: string; email: string; full_name: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
  }

  async login(email: string, password: string) {
    const response = await this.request<{
      access_token: string;
      token_type: string;
      expires_in: number;
      user: { id: string; email: string; full_name: string; avatar_url: string | null };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.data?.access_token) {
      this.setAccessToken(response.data.access_token);
    }

    return response;
  }

  async refresh() {
    const response = await this.request<{
      access_token: string;
      token_type: string;
      expires_in: number;
    }>('/auth/refresh', { method: 'POST' });

    if (response.data?.access_token) {
      this.setAccessToken(response.data.access_token);
    }

    return response;
  }

  async logout() {
    const response = await this.request('/auth/logout', { method: 'POST' });
    this.setAccessToken(null);
    return response;
  }

  async logoutAll() {
    const response = await this.request('/auth/logout-all', { method: 'POST' });
    this.setAccessToken(null);
    return response;
  }

  // User endpoints
  async getMe() {
    return this.request<{
      id: string;
      email: string;
      full_name: string;
      avatar_url: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>('/me');
  }

  async updateProfile(data: { full_name?: string; avatar_url?: string }) {
    return this.request('/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string, confirmation: string) {
    return this.request('/me/password', {
      method: 'PATCH',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmation,
      }),
    });
  }

  // Sessions
  async getSessions() {
    return this.request<Array<{
      id: string;
      device_info: string;
      ip_address: string;
      created_at: string;
      last_active_at: string;
      is_current: boolean;
    }>>('/auth/sessions');
  }

  async revokeSession(sessionId: string) {
    return this.request(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
  }

  // Folders
  async getFolderTree(includeFiles = false, includeCounts = true, workspaceId?: string | null) {
    const params = new URLSearchParams();
    params.set('include_files', String(includeFiles));
    params.set('include_counts', String(includeCounts));
    if (workspaceId) params.set('workspace_id', workspaceId);
    return this.request<FolderTreeItem[]>(`/folders/tree?${params.toString()}`);
  }

  async createFolder(name: string, parentId?: string | null) {
    return this.request<FolderTreeItem>('/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parent_id: parentId }),
    });
  }

  async renameFolder(id: string, name: string) {
    return this.request(`/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  async moveFolder(id: string, parentId: string | null, sortOrder?: number) {
    return this.request(`/folders/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ parent_id: parentId, sort_order: sortOrder }),
    });
  }

  async deleteFolder(id: string) {
    return this.request(`/folders/${id}`, { method: 'DELETE' });
  }

  // Files
  async getFiles(params?: {
    folder_id?: string | null;
    workspace_id?: string | null;
    status?: string;
    search?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.folder_id) searchParams.set('folder_id', params.folder_id);
    if (params?.workspace_id) searchParams.set('workspace_id', params.workspace_id);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.sort) searchParams.set('sort', params.sort);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    return this.request<FileItem[]>(`/files${query ? `?${query}` : ''}`);
  }

  async getFile(id: string) {
    return this.request<FileItem>(`/files/${id}`);
  }

  async moveFile(id: string, folderId: string | null) {
    return this.request(`/files/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ folder_id: folderId }),
    });
  }

  async renameFile(id: string, name: string) {
    return this.request(`/files/${id}/rename`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  }

  async deleteFile(id: string) {
    return this.request(`/files/${id}`, { method: 'DELETE' });
  }

  async exportFiles(params?: {
    folder_id?: string | null;
    workspace_id?: string | null;
    status?: string;
    search?: string;
    file_ids?: string[];
    format?: 'csv' | 'json';
  }) {
    const searchParams = new URLSearchParams();
    if (params?.folder_id) searchParams.set('folder_id', params.folder_id);
    if (params?.workspace_id) searchParams.set('workspace_id', params.workspace_id);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.file_ids && params.file_ids.length > 0) {
      searchParams.set('file_ids', params.file_ids.join(','));
    }
    if (params?.format) searchParams.set('format', params.format);

    const query = searchParams.toString();
    const url = `${API_BASE_URL}/files/export${query ? `?${query}` : ''}`;

    // Create an anchor element to trigger download
    // We do this via fetch to handle headers if needed, but direct link is easier for blob
    // However, we need to pass Auth token.

    const token = this.getAccessToken();
    const headers: HeadersInit = {};
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;

    // Try to get filename from Content-Disposition
    const disposition = response.headers.get('Content-Disposition');
    const contentType = response.headers.get('Content-Type');
    const ext = (contentType?.includes('json') || params?.format === 'json') ? 'json' : 'csv';
    let filename = `export.${ext}`;
    if (disposition && disposition.indexOf('attachment') !== -1) {
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(disposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    }

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  }

  // Upload
  async getPresignedUploadUrl(filename: string, fileSize: number, contentType: string, folderId?: string | null, workspaceId?: string | null) {
    return this.request<{
      upload_id: string;
      presigned_url: string;
      storage_path: string;
      expires_at: string;
      headers: Record<string, string>;
    }>('/files/upload/presign', {
      method: 'POST',
      body: JSON.stringify({
        filename,
        file_size: fileSize,
        content_type: contentType,
        folder_id: folderId,
        workspace_id: workspaceId,
      }),
    });
  }

  async confirmUpload(uploadId: string) {
    return this.request<FileItem>('/files/upload/confirm', {
      method: 'POST',
      body: JSON.stringify({ upload_id: uploadId }),
    });
  }

  async getDownloadUrl(fileId: string) {
    return this.request<{
      download_url: string;
      filename: string;
      expires_at: string;
    }>(`/files/${fileId}/download`);
  }

  // Avatar upload
  async getAvatarPresignedUrl(filename: string, fileSize: number, contentType: string) {
    return this.request<{
      upload_id: string;
      presigned_url: string;
      expires_at: string;
    }>('/uploads/avatar/presign', {
      method: 'POST',
      body: JSON.stringify({ filename, file_size: fileSize, content_type: contentType }),
    });
  }

  async confirmAvatarUpload(uploadId: string) {
    return this.request<{ avatar_url: string }>('/uploads/avatar/confirm', {
      method: 'POST',
      body: JSON.stringify({ upload_id: uploadId }),
    });
  }

  // Summaries
  async getSummaryStyles() {
    return this.request<SummaryStyle[]>('/summary-styles');
  }

  async getSummary(fileId: string, version?: number) {
    const query = version ? `?version=${version}` : '';
    return this.request<Summary | { status: string; message: string }>(`/summaries/${fileId}${query}`);
  }

  async getSummaryHistory(fileId: string) {
    return this.request<SummaryHistoryItem[]>(`/summaries/${fileId}/history`);
  }

  async generateSummary(fileId: string, style: string, customInstructions?: string, language: string = 'en') {
    return this.request<{
      file_id: string;
      status: string;
      job_id: string;
      style: string;
      custom_instructions?: string;
    }>(`/summaries/${fileId}/generate`, {
      method: 'POST',
      body: JSON.stringify({ style, custom_instructions: customInstructions, language }),
    });
  }
  // Workspaces
  async createWorkspace(name: string) {
    return this.request<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async updateWorkspace(id: string, name: string) {
    return this.request<Workspace>(`/workspaces/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
  }

  async joinWorkspace(inviteCode: string) {
    return this.request<Workspace>('/workspaces/join', {
      method: 'POST',
      body: JSON.stringify({ invite_code: inviteCode }),
    });
  }

  async getWorkspaces() {
    return this.request<Workspace[]>('/workspaces');
  }

  async getWorkspaceMembers(id: string) {
    return this.request<WorkspaceMember[]>(`/workspaces/${id}/members`);
  }
}

// Types
export interface FolderTreeItem {
  id: string;
  name: string;
  parent_id: string | null;
  depth: number;
  sort_order: number;
  file_count?: number;
  total_size?: number;
  created_at: string;
  children: FolderTreeItem[];
}

export interface FileItem {
  id: string;
  filename: string;
  original_filename: string;
  folder_id: string | null;
  file_size: number;
  page_count?: number;
  status: 'uploaded' | 'pending' | 'processing' | 'completed' | 'failed';
  has_summary?: boolean;
  uploaded_at: string;
  processed_at?: string;
  download_url?: string;
  summary?: {
    id: string;
    title: string;
    version: number;
    processing_duration_ms: number;
    created_at: string;
  };
}

export interface SummaryStyle {
  id: string;
  name: string;
  description: string;
  example_output: string;
}

export interface Summary {
  id: string;
  file_id: string;
  title: string;
  content: string;
  style: string;
  custom_instructions?: string;
  model_used: string;
  prompt_tokens: number;
  completion_tokens: number;
  processing_started_at: string;
  processing_completed_at: string;
  processing_duration_ms: number;
  language: string;
  version: number;
  is_current: boolean;
  created_at: string;
}

export interface SummaryHistoryItem {
  id: string;
  version: number;
  title: string;
  style: string;
  custom_instructions?: string;
  model_used: string;
  processing_duration_ms: number;
  language: string;
  is_current: boolean;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  invite_code?: string;
  role: string;
  is_owner: boolean;
  member_count?: number;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user?: {
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

export const api = new ApiClient();
