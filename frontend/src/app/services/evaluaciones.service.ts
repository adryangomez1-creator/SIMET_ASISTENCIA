import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EmpleadoEvaluacion {
  id: number;
  codigo_empleado: string;
  nombre: string;
  puesto_id: number;
  nombre_puesto: string;
  departamento: string;
}

export interface OpcionCriterio {
  label: string;
  value: number;
}

export interface CriterioEvaluacion {
  id: number;
  puesto_id: number;
  categoria: 'TECNICO' | 'PSICOMETRICO' | string;
  pregunta: string;
  tipo: 'ESCALA_1_5' | 'TEXTO' | 'OPCION_MULTIPLE';
  opciones: OpcionCriterio[] | null;
}

export interface RespuestaEvaluacion {
  criterio_id: number;
  puntuacion: number | null;
  respuesta_texto: string | null;
  observaciones: string;
}

export interface EvaluacionHistorial {
  id: number;
  creado_en: string;
  promedio_tecnico: number | string | null;
  promedio_psicometrico: number | string | null;
  evaluador_nombre: string;
  nombre_puesto: string;
  respuestas: Array<RespuestaEvaluacion & { categoria: string; pregunta: string }>;
}

@Injectable({ providedIn: 'root' })
export class EvaluacionesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/evaluaciones`;

  obtenerEmpleados(): Observable<{ empleados: EmpleadoEvaluacion[] }> {
    return this.http.get<{ empleados: EmpleadoEvaluacion[] }>(`${this.baseUrl}/empleados`);
  }

  obtenerCriterios(puestoId: number): Observable<{ criterios: CriterioEvaluacion[] }> {
    return this.http.get<{ criterios: CriterioEvaluacion[] }>(`${this.baseUrl}/criterios/${puestoId}`);
  }

  guardar(datos: { empleado_id: number; puesto_id: number; respuestas: RespuestaEvaluacion[] }): Observable<{ id: number; mensaje: string }> {
    return this.http.post<{ id: number; mensaje: string }>(`${this.baseUrl}/guardar`, datos);
  }

  obtenerHistorial(empleadoId: number): Observable<{ evaluaciones: EvaluacionHistorial[] }> {
    return this.http.get<{ evaluaciones: EvaluacionHistorial[] }>(`${this.baseUrl}/historial/${empleadoId}`);
  }
}