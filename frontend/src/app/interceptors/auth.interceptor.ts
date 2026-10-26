import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).getToken();
  const isApiRequest = request.url.startsWith(environment.apiUrl) || request.url.includes('/api/');

  if (!token || !isApiRequest) return next(request);
  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};