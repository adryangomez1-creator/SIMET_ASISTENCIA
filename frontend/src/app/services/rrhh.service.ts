import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Marcacion } from './asistencia.service';

export interface FiltrosAsistencia {
  busqueda?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface DatosCorreccion {
  marcacion_id: number;
  motivo: string;
  hora_entrada?: string;
  hora_salida?: string;
}

export interface DatosIncidencia {
  empleado_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  tipo: 'permiso_oficial' | 'ausencia_justificada' | 'suspension' | 'vacaciones';
  motivo: string;
}

  export interface EmpleadoRrhh {
    id: number;
    codigo_empleado: string;
    nombre: string;
  }

@Injectable({ providedIn: 'root' })
export class RrhhService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/rrhh`;

  obtenerAsistencias(filtros: FiltrosAsistencia): Observable<{ asistencias: Marcacion[] }> {
    let params = new HttpParams();
    if (filtros.busqueda) params = params.set('codigo_empleado', filtros.busqueda);
    if (filtros.fecha_inicio) params = params.set('fecha_inicio', filtros.fecha_inicio);
    if (filtros.fecha_fin) params = params.set('fecha_fin', filtros.fecha_fin);
    return this.http.get<{ asistencias: Marcacion[] }>(`${this.baseUrl}/asistencias`, { params });
  }

      obtenerEmpleados(): Observable<{ empleados: EmpleadoRrhh[] }> {
        return this.http.get<{ empleados: EmpleadoRrhh[] }>(`${this.baseUrl}/empleados`);
      }

  corregirMarcacion(datos: DatosCorreccion): Observable<{ mensaje: string }> {
    return this.http.put<{ mensaje: string }>(`${this.baseUrl}/corregir`, datos);
  }

  registrarIncidencia(datos: DatosIncidencia): Observable<{ mensaje: string; id: number }> {
    return this.http.post<{ mensaje: string; id: number }>(`${this.baseUrl}/incidencias`, datos);
  }

  descargarExcel(filtros: FiltrosAsistencia): Observable<Blob> {
    let params = new HttpParams();
    if (filtros.busqueda) params = params.set('codigo_empleado', filtros.busqueda);
    if (filtros.fecha_inicio) params = params.set('fecha_inicio', filtros.fecha_inicio);
    if (filtros.fecha_fin) params = params.set('fecha_fin', filtros.fecha_fin);
    return this.http.get(`${this.baseUrl}/exportar-excel`, { params, responseType: 'blob' });
  }
}