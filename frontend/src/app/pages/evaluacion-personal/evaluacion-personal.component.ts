import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {
  CriterioEvaluacion,
  EmpleadoEvaluacion,
  EvaluacionHistorial,
  EvaluacionesService,
  PuestoEvaluacion,
} from '../../services/evaluaciones.service';

@Component({
  selector: 'app-evaluacion-personal',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './evaluacion-personal.component.html',
  styleUrl: './evaluacion-personal.component.css',
})
export class EvaluacionPersonalComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly evaluacionesApi = inject(EvaluacionesService);
  private readonly auth = inject(AuthService);

  protected readonly usuario = this.auth.getUsuario();
  protected readonly empleados = signal<EmpleadoEvaluacion[]>([]);
  protected readonly empleado = signal<EmpleadoEvaluacion | null>(null);
  protected readonly puestos = signal<PuestoEvaluacion[]>([]);
  protected readonly puestoId = signal<number | null>(null);
  protected readonly criterios = signal<CriterioEvaluacion[]>([]);
  protected readonly historial = signal<EvaluacionHistorial[]>([]);
  protected readonly comentariosRevision: Record<number, string> = {};
  protected readonly calificacionesRevision: Record<number, number | ''> = {};
  protected readonly criterioEditando = signal<number | null>(null);
  protected readonly cargandoEmpleados = signal(true);
  protected readonly cargandoCriterios = signal(false);
  protected readonly cargandoHistorial = signal(false);
  protected readonly guardando = signal(false);
  protected readonly aviso = signal<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  protected readonly preguntaForm = this.formBuilder.nonNullable.group({
    pregunta: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
  });

  ngOnInit(): void {
    this.evaluacionesApi.obtenerEmpleados().subscribe({
      next: ({ empleados }) => {
        this.empleados.set(empleados);
        this.cargandoEmpleados.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.cargandoEmpleados.set(false);
        this.mostrarError(error, 'No se pudieron cargar los empleados.');
      },
    });

    this.evaluacionesApi.obtenerPuestos().subscribe({
      next: ({ puestos }) => {
        this.puestos.set(puestos);
        if (puestos.length) {
          this.puestoId.set(puestos[0].id);
          this.cargarCriterios(puestos[0].id);
        }
      },
      error: (error: HttpErrorResponse) => this.mostrarError(error, 'No se pudieron cargar los puestos.'),
    });
  }

  protected seleccionarEmpleado(event: Event): void {
    const empleadoId = Number((event.target as HTMLSelectElement).value);
    const seleccionado = this.empleados().find((item) => item.id === empleadoId) || null;
    this.empleado.set(seleccionado);
    this.historial.set([]);
    this.aviso.set(null);
    if (!seleccionado) return;

    this.cargandoHistorial.set(true);
    this.evaluacionesApi.obtenerHistorial(seleccionado.id).subscribe({
      next: ({ evaluaciones }) => {
        this.historial.set(evaluaciones);
        for (const evaluacion of evaluaciones) {
          this.comentariosRevision[evaluacion.id] = evaluacion.comentario_revision || '';
          this.calificacionesRevision[evaluacion.id] = evaluacion.calificacion_revision
            ? Number(evaluacion.calificacion_revision)
            : '';
        }
        this.cargandoHistorial.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.cargandoHistorial.set(false);
        this.mostrarError(error, 'No se pudo cargar el historial de evaluaciones.');
      },
    });
  }

  protected seleccionarPuesto(event: Event): void {
    const puestoId = Number((event.target as HTMLSelectElement).value);
    this.puestoId.set(puestoId || null);
    this.criterioEditando.set(null);
    this.preguntaForm.reset({ pregunta: '' });
    if (puestoId) this.cargarCriterios(puestoId);
  }

  protected editarCriterio(criterio: CriterioEvaluacion): void {
    this.criterioEditando.set(criterio.id);
    this.preguntaForm.setValue({ pregunta: criterio.pregunta });
    this.aviso.set(null);
  }

  protected cancelarEdicion(): void {
    this.criterioEditando.set(null);
    this.preguntaForm.reset({ pregunta: '' });
  }

  protected guardarCriterio(): void {
    this.preguntaForm.markAllAsTouched();
    const puestoId = this.puestoId();
    const pregunta = this.preguntaForm.controls.pregunta.value.trim();
    const criterioId = this.criterioEditando();
    if (this.preguntaForm.invalid || !puestoId || this.guardando()) return;

    this.guardando.set(true);
    const solicitud = criterioId
      ? this.evaluacionesApi.actualizarCriterio(criterioId, pregunta)
      : this.evaluacionesApi.crearCriterio(puestoId, pregunta);
    solicitud.subscribe({
      next: ({ mensaje }) => {
        this.aviso.set({ tipo: 'success', texto: mensaje });
        this.guardando.set(false);
        this.cancelarEdicion();
        this.cargarCriterios(puestoId);
      },
      error: (error: HttpErrorResponse) => this.mostrarError(error, 'No fue posible guardar la pregunta.'),
    });
  }

  protected eliminarCriterio(criterio: CriterioEvaluacion): void {
    if (!globalThis.confirm(`¿Eliminar la pregunta "${criterio.pregunta}"?`)) return;
    this.evaluacionesApi.eliminarCriterio(criterio.id).subscribe({
      next: ({ mensaje }) => {
        this.aviso.set({ tipo: 'success', texto: mensaje });
        const puestoId = this.puestoId();
        if (puestoId) this.cargarCriterios(puestoId);
      },
      error: (error: HttpErrorResponse) => this.mostrarError(error, 'No fue posible eliminar la pregunta.'),
    });
  }

  protected capturarRevision(evaluacionId: number, event: Event): void {
    this.comentariosRevision[evaluacionId] = (event.target as HTMLTextAreaElement).value;
  }

  protected capturarCalificacion(evaluacionId: number, event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.calificacionesRevision[evaluacionId] = value || '';
  }

  protected guardarRevision(evaluacion: EvaluacionHistorial): void {
    const comentario = (this.comentariosRevision[evaluacion.id] || '').trim();
    const calificacion = this.calificacionesRevision[evaluacion.id];
    if (!comentario || !calificacion) {
      this.aviso.set({ tipo: 'error', texto: 'Selecciona una calificación y escribe una revisión antes de guardarla.' });
      return;
    }

    this.guardando.set(true);
    this.evaluacionesApi.guardarRevision(evaluacion.id, calificacion, comentario).subscribe({
      next: ({ mensaje }) => {
        this.aviso.set({ tipo: 'success', texto: mensaje });
        this.guardando.set(false);
        const empleadoId = this.empleado()?.id;
        if (empleadoId) this.recargarHistorial(empleadoId);
      },
      error: (error: HttpErrorResponse) => this.mostrarError(error, 'No fue posible guardar la revisión.'),
    });
  }

  protected fecha(value: string): string {
    return new Date(value).toLocaleString('es-GT', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Guatemala',
    });
  }

  protected salir(): void {
    this.auth.logout();
  }

  private cargarCriterios(puestoId: number): void {
    this.cargandoCriterios.set(true);
    this.evaluacionesApi.obtenerCriterios(puestoId).subscribe({
      next: ({ criterios }) => {
        this.criterios.set(criterios);
        this.cargandoCriterios.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.criterios.set([]);
        this.cargandoCriterios.set(false);
        this.mostrarError(error, 'No se pudieron cargar las preguntas del puesto.');
      },
    });
  }

  private recargarHistorial(empleadoId: number): void {
    this.evaluacionesApi.obtenerHistorial(empleadoId).subscribe({
      next: ({ evaluaciones }) => {
        this.historial.set(evaluaciones);
        for (const evaluacion of evaluaciones) {
          this.comentariosRevision[evaluacion.id] = evaluacion.comentario_revision || '';
          this.calificacionesRevision[evaluacion.id] = evaluacion.calificacion_revision
            ? Number(evaluacion.calificacion_revision)
            : '';
        }
      },
      error: (error: HttpErrorResponse) => this.mostrarError(error, 'No se pudo actualizar el historial.'),
    });
  }

  private mostrarError(error: HttpErrorResponse, respaldo: string): void {
    this.aviso.set({ tipo: 'error', texto: error.error?.mensaje || respaldo });
    this.guardando.set(false);
  }
}
