import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ExamenAspirante {
  id: number;
  title: string;
  description: string;
  target_role: string;
  question_count: number;
  max_score: number | string;
}

export interface PreguntaExamen {
  id: number;
  section: string;
  question_text: string;
  question_type: 'MULTIPLE_CHOICE' | 'OPEN_TEXT';
  options: string[] | null;
  max_score: number | string;
}

export interface CredencialesAspirante {
  nombre: string;
  correo: string;
  usuario: string;
  password_temporal: string;
  expira_en: string;
}

export interface EnvioExamen {
  id: number;
  exam_id: number;
  titulo_examen: string;
  puesto: string;
  nombre: string;
  correo: string;
  usuario: string;
  auto_score: number | string;
  final_score: number | string | null;
  review_status: 'PENDING_REVIEW' | 'REVIEWED';
  submitted_at: string;
}

export interface RespuestaRevision {
  answer_id: number;
  selected_option: number | null;
  response_text: string | null;
  awarded_score: number | string | null;
  reviewer_comment: string | null;
  question_id: number;
  section: string;
  question_text: string;
  question_type: 'MULTIPLE_CHOICE' | 'OPEN_TEXT';
  options: string[] | null;
  correct_option: number | null;
  max_score: number | string;
  review_guide: string | null;
}

export interface DetalleEnvio {
  envio: EnvioExamen;
  respuestas: RespuestaRevision[];
}

@Injectable({ providedIn: 'root' })
export class ExamenesAspirantesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  obtenerExamenes(): Observable<{ examenes: ExamenAspirante[] }> {
    return this.http.get<{ examenes: ExamenAspirante[] }>(`${this.baseUrl}/admin/exams`);
  }

  generarAspirante(datos: { nombre: string; correo: string; exam_id: number }): Observable<{
    mensaje: string;
    credenciales: CredencialesAspirante;
  }> {
    return this.http.post<{ mensaje: string; credenciales: CredencialesAspirante }>(
      `${this.baseUrl}/admin/generate-aspirant`,
      datos,
    );
  }

  obtenerEnvios(): Observable<{ envios: EnvioExamen[] }> {
    return this.http.get<{ envios: EnvioExamen[] }>(`${this.baseUrl}/admin/submissions`);
  }

  obtenerEnvio(id: number): Observable<DetalleEnvio> {
    return this.http.get<DetalleEnvio>(`${this.baseUrl}/admin/submissions/${id}`);
  }

  guardarRevision(id: number, respuestas: Array<{ answer_id: number; score: number; comment: string }>): Observable<{
    mensaje: string;
    puntaje_final: number;
  }> {
    return this.http.put<{ mensaje: string; puntaje_final: number }>(
      `${this.baseUrl}/admin/submissions/${id}/review`,
      { respuestas },
    );
  }

  obtenerMiExamen(): Observable<{ examen: { id: number; titulo: string }; preguntas: PreguntaExamen[] }> {
    return this.http.get<{ examen: { id: number; titulo: string }; preguntas: PreguntaExamen[] }>(
      `${this.baseUrl}/exams/me`,
    );
  }

  enviarRespuestas(respuestas: Array<{
    question_id: number;
    selected_option?: number;
    response_text?: string;
  }>): Observable<{
    mensaje: string;
    puntaje_automatico: number;
    puntaje_maximo: number;
    pendiente_revision: boolean;
  }> {
    return this.http.post<{
      mensaje: string;
      puntaje_automatico: number;
      puntaje_maximo: number;
      pendiente_revision: boolean;
    }>(`${this.baseUrl}/exams/me/submit`, { respuestas });
  }
}
