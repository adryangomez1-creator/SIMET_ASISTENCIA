import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Marcacion {
  id: number;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  estado_entrada: 'puntual' | 'atraso' | null;
  estado_salida: 'normal' | 'anticipada' | null;
  codigo_empleado?: string;
  nombre?: string;
  nombre_puesto?: string;
  empleado_id?: number;
}

export interface ResultadoMarcacion {
  tipo: 'entrada' | 'salida';
  hora: string;
  estado: string;
}

@Injectable({ providedIn: 'root' })
export class AsistenciaService {
  private readonly http = inject(HttpClient);

  registrarMarcacion(): Observable<ResultadoMarcacion> {
    return this.http.post<ResultadoMarcacion>(`${environment.apiUrl}/asistencia/marcar`, {});
  }

  obtenerHistorial(): Observable<{ marcaciones: Marcacion[] }> {
    return this.http.get<{ marcaciones: Marcacion[] }>(`${environment.apiUrl}/asistencia/mi-historial`);
  }
}