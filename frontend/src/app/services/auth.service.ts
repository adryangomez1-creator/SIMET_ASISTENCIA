import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Usuario {
  id: number;
  codigo_empleado: string;
  nombre: string;
  puesto: string;
  rol: string;
  rol_id: number;
}

interface LoginResponse {
  token: string;
  usuario: Usuario;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenKey = 'simet_token';
  private readonly userKey = 'simet_usuario';

  login(codigo_empleado: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, {
      codigo_empleado,
      password,
    }).pipe(tap((response) => {
      localStorage.setItem(this.tokenKey, response.token);
      localStorage.setItem(this.userKey, JSON.stringify(response.usuario));
    }));
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    void this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUsuario(): Usuario | null {
    const cached = localStorage.getItem(this.userKey);
    if (cached) {
      try {
        return JSON.parse(cached) as Usuario;
      } catch {
        localStorage.removeItem(this.userKey);
      }
    }
    return this.getPayload();
  }

  getPayload(): Usuario | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const normalized = decodeURIComponent(Array.from(decoded)
        .map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''));
      return JSON.parse(normalized) as Usuario;
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
      return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  hasRrhhRole(): boolean {
    const roleId = Number(this.getPayload()?.rol_id ?? this.getUsuario()?.rol_id);
    return roleId === 2 || roleId === 3;
  }
}