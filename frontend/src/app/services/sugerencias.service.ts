import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TipoSugerencia = 'SUGERENCIA' | 'QUEJA' | 'OTRO';

export interface Sugerencia {
  id: number;
  tipo: TipoSugerencia;
  contenido: string;
  anonima: boolean | number;
  creado_en: string;
  remitente: string | null;
}

@Injectable({ providedIn: 'root' })
export class SugerenciasService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/sugerencias`;

  crear(datos: { tipo: TipoSugerencia; contenido: string; anonima: boolean }): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(this.baseUrl, datos);
  }

  obtenerTodas(): Observable<{ sugerencias: Sugerencia[] }> {
    return this.http.get<{ sugerencias: Sugerencia[] }>(this.baseUrl);
  }
}
