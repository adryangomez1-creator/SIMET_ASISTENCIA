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

export interface PuestoEvaluacion {
  id: number;
  codigo_abreviatura: string;
  nombre_puesto: string;
  empleados_activos: number;
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
  calificacion_revision: number | string | null;
  comentario_revision: string | null;
  revisado_en: string | null;
  revisor_nombre: string | null;
  respuestas: Array<RespuestaEvaluacion & { categoria: string; pregunta: string }>;
}

@Injectable({ providedIn: 'root' })
export class EvaluacionesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/evaluaciones`;

  obtenerPuestos(): Observable<{ puestos: PuestoEvaluacion[] }> {
    return this.http.get<{ puestos: PuestoEvaluacion[] }>(`${this.baseUrl}/puestos`);
  }

  obtenerEmpleados(): Observable<{ empleados: EmpleadoEvaluacion[] }> {
    return this.http.get<{ empleados: EmpleadoEvaluacion[] }>(`${this.baseUrl}/empleados`);
  }

  obtenerMisCriterios(): Observable<{ puesto: string; criterios: CriterioEvaluacion[] }> {
    return this.http.get<{ puesto: string; criterios: CriterioEvaluacion[] }>(`${this.baseUrl}/mis-criterios`);
  }

  obtenerCriterios(puestoId: number): Observable<{ criterios: CriterioEvaluacion[] }> {
    return this.http.get<{ criterios: CriterioEvaluacion[] }>(`${this.baseUrl}/criterios/${puestoId}`);
  }

  guardar(respuestas: RespuestaEvaluacion[]): Observable<{ id: number; mensaje: string }> {
    return this.http.post<{ id: number; mensaje: string }>(`${this.baseUrl}/guardar`, { respuestas });
  }

  guardarRevision(evaluacionId: number, calificacion: number, comentario_revision: string): Observable<{ mensaje: string }> {
    return this.http.put<{ mensaje: string }>(`${this.baseUrl}/revision/${evaluacionId}`, { calificacion, comentario_revision });
  }

  crearCriterio(puesto_id: number, pregunta: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.baseUrl}/criterios`, { puesto_id, pregunta });
  }

  actualizarCriterio(criterioId: number, pregunta: string): Observable<{ mensaje: string }> {
    return this.http.put<{ mensaje: string }>(`${this.baseUrl}/criterios/${criterioId}`, { pregunta });
  }

  eliminarCriterio(criterioId: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.baseUrl}/criterios/${criterioId}`);
  }

  obtenerHistorial(empleadoId: number): Observable<{ evaluaciones: EvaluacionHistorial[] }> {
    return this.http.get<{ evaluaciones: EvaluacionHistorial[] }>(`${this.baseUrl}/historial/${empleadoId}`);
  }
}