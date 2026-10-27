import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  return Number(auth.getPayload()?.rol_id ?? auth.getUsuario()?.rol_id) === 3
    ? true
    : router.createUrlTree(['/dashboard'], { queryParams: { acceso: 'denegado' } });
};