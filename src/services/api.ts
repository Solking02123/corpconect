const API_URL = '';

async function request(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as object || {}),
  };

  if (options.body instanceof FormData) {
    // Let browser set content type for multipart
    delete (headers as any)['Content-Type'];
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!response.ok) {
    if (isJson) {
      const error = await response.json();
      throw new Error(error.error || 'حدث خطأ في طلب البيانات');
    } else {
      const text = await response.text();
      console.error('Non-JSON Error Response:', text);
      throw new Error(`خطأ في النظام (${response.status}): يرجى المحاولة لاحقاً`);
    }
  }

  if (isJson) {
    return response.json();
  }
  return response.text();
}

export const api = {
  get: (endpoint: string) => request(endpoint),
  post: (endpoint: string, body: any) => request(endpoint, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: (endpoint: string, body: any) => request(endpoint, { method: 'PATCH', body: body instanceof FormData ? body : JSON.stringify(body) }),
  delete: (endpoint: string) => request(endpoint, { method: 'DELETE' }),
};
