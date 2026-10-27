import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideLogOut, lucideSave } from '@ng-icons/lucide';
import {
  CriterioEvaluacion,
  EmpleadoEvaluacion,
  EvaluacionHistorial,
  EvaluacionesService,
  RespuestaEvaluacion,
} from '../../services/evaluaciones.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-evaluacion-personal',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgIcon],
  providers: [provideIcons({ lucideArrowLeft, lucideLogOut, lucideSave })],
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
  protected readonly criterios = signal<CriterioEvaluacion[]>([]);
  protected readonly historial = signal<EvaluacionHistorial[]>([]);
  protected readonly cargandoEmpleados = signal(true);
  protected readonly cargandoCriterios = signal(false);
  protected readonly cargandoHistorial = signal(false);
  protected readonly guardando = signal(false);
  protected readonly aviso = signal<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  protected readonly empleadoForm = this.formBuilder.group({
    empleado_id: this.formBuilder.control<number | null>(null, Validators.required),
  });
  protected readonly respuestasForm = new FormRecord<FormControl<number | string | null>>({});
  protected readonly observacionesForm = new FormRecord<FormControl<string>>({});

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
  }

  protected seleccionarEmpleado(): void {
    const empleadoId = this.empleadoForm.controls.empleado_id.value;
    const seleccionado = this.empleados().find((item) => item.id === empleadoId) || null;
    this.empleado.set(seleccionado);
    this.criterios.set([]);
    this.historial.set([]);
    this.limpiarRespuestas();
    this.aviso.set(null);
    if (!seleccionado) return;

    this.cargandoCriterios.set(true);
    this.evaluacionesApi.obtenerCriterios(seleccionado.puesto_id).subscribe({
      next: ({ criterios }) => {
        this.criterios.set(criterios);
        for (const criterio of criterios) {
          this.respuestasForm.addControl(String(criterio.id), new FormControl<number | string | null>(null, Validators.required));
          this.observacionesForm.addControl(String(criterio.id), new FormControl('', { nonNullable: true }));
        }
        this.cargandoCriterios.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.cargandoCriterios.set(false);
        this.mostrarError(error, 'No se pudieron cargar los criterios del puesto.');
      },
    });

    this.cargandoHistorial.set(true);
    this.evaluacionesApi.obtenerHistorial(seleccionado.id).subscribe({
      next: ({ evaluaciones }) => {
        this.historial.set(evaluaciones);
        this.cargandoHistorial.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.cargandoHistorial.set(false);
        this.mostrarError(error, 'No se pudo cargar el historial de evaluaciones.');
      },
    });
  }

  protected controlRespuesta(criterioId: number): FormControl<number | string | null> {
    return this.respuestasForm.controls[String(criterioId)];
  }

  protected controlObservaciones(criterioId: number): FormControl<string> {
    return this.observacionesForm.controls[String(criterioId)];
  }

  protected criteriosPorCategoria(categoria: string): CriterioEvaluacion[] {
    return this.criterios().filter((criterio) => criterio.categoria === categoria);
  }

  protected promedio(categoria: string): string {
    const puntuaciones = this.criteriosPorCategoria(categoria)
      .map((criterio) => Number(this.respuestasForm.controls[String(criterio.id)]?.value))
      .filter((valor) => Number.isFinite(valor) && valor >= 1 && valor <= 5);
    if (!puntuaciones.length) return '—';
    return (puntuaciones.reduce((total, valor) => total + valor, 0) / puntuaciones.length).toFixed(2);
  }

  protected guardar(): void {
    this.empleadoForm.markAllAsTouched();
    this.respuestasForm.markAllAsTouched();
    const seleccionado = this.empleado();
    if (!seleccionado || !this.criterios().length || this.respuestasForm.invalid || this.guardando()) return;

    const respuestas: RespuestaEvaluacion[] = this.criterios().map((criterio) => {
      const valor = this.controlRespuesta(criterio.id).value;
      return {
        criterio_id: criterio.id,
        puntuacion: criterio.tipo === 'TEXTO' ? null : Number(valor),
        respuesta_texto: criterio.tipo === 'TEXTO' ? String(valor || '').trim() : null,
        observaciones: this.controlObservaciones(criterio.id).value.trim(),
      };
    });

    this.guardando.set(true);
    this.evaluacionesApi.guardar({
      empleado_id: seleccionado.id,
      puesto_id: seleccionado.puesto_id,
      respuestas,
    }).subscribe({
      next: ({ mensaje }) => {
        this.aviso.set({ tipo: 'success', texto: mensaje });
        this.guardando.set(false);
        this.limpiarRespuestas();
        for (const criterio of this.criterios()) {
          this.respuestasForm.addControl(String(criterio.id), new FormControl<number | string | null>(null, Validators.required));
          this.observacionesForm.addControl(String(criterio.id), new FormControl('', { nonNullable: true }));
        }
        this.evaluacionesApi.obtenerHistorial(seleccionado.id).subscribe({
          next: ({ evaluaciones }) => this.historial.set(evaluaciones),
        });
      },
      error: (error: HttpErrorResponse) => this.mostrarError(error, 'No fue posible guardar la evaluación.'),
    });
  }

  protected fecha(value: string): string {
    return new Date(value).toLocaleString('es-GT', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Guatemala',
    });
  }

  protected puntuacion(value: number | string | null): string {
    return value === null ? '—' : Number(value).toFixed(2);
  }

  protected salir(): void {
    this.auth.logout();
  }

  private limpiarRespuestas(): void {
    for (const id of Object.keys(this.respuestasForm.controls)) this.respuestasForm.removeControl(id);
    for (const id of Object.keys(this.observacionesForm.controls)) this.observacionesForm.removeControl(id);
  }

  private mostrarError(error: HttpErrorResponse, respaldo: string): void {
    this.aviso.set({ tipo: 'error', texto: error.error?.mensaje || respaldo });
    this.guardando.set(false);
  }
}