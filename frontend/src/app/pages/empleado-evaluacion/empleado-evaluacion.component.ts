import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut } from '@ng-icons/lucide';
import { AuthService } from '../../services/auth.service';
import { CriterioEvaluacion, EvaluacionesService, RespuestaEvaluacion } from '../../services/evaluaciones.service';

@Component({
  selector: 'app-empleado-evaluacion',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgIcon],
  providers: [provideIcons({ lucideLogOut })],
  templateUrl: './empleado-evaluacion.component.html',
})
export class EmpleadoEvaluacionComponent implements OnInit {
  private readonly evaluacionesApi = inject(EvaluacionesService);
  private readonly auth = inject(AuthService);

  protected readonly usuario = this.auth.getUsuario();
  protected readonly puesto = signal('');
  protected readonly criterios = signal<CriterioEvaluacion[]>([]);
  protected readonly respuestas = new FormRecord<FormControl<string>>({});
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly enviada = signal(false);
  protected readonly aviso = signal<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  ngOnInit(): void {
    this.evaluacionesApi.obtenerMisCriterios().subscribe({
      next: ({ puesto, criterios }) => {
        this.puesto.set(puesto);
        this.criterios.set(criterios);
        for (const criterio of criterios) {
          this.respuestas.addControl(
            String(criterio.id),
            new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(5000)] }),
          );
        }
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);
        this.aviso.set({ tipo: 'error', texto: error.error?.mensaje || 'No se pudieron cargar las preguntas de tu puesto.' });
      },
    });
  }

  protected control(criterioId: number): FormControl<string> {
    return this.respuestas.controls[String(criterioId)];
  }

  protected enviar(): void {
    this.respuestas.markAllAsTouched();
    if (this.respuestas.invalid || !this.criterios().length || this.guardando()) return;

    const respuestas: RespuestaEvaluacion[] = this.criterios().map((criterio) => ({
      criterio_id: criterio.id,
      puntuacion: null,
      respuesta_texto: this.control(criterio.id).value.trim(),
      observaciones: '',
    }));

    this.guardando.set(true);
    this.aviso.set(null);
    this.evaluacionesApi.guardar(respuestas).subscribe({
      next: ({ mensaje }) => {
        this.aviso.set({ tipo: 'success', texto: mensaje });
        this.guardando.set(false);
        this.enviada.set(true);
      },
      error: (error: HttpErrorResponse) => {
        this.aviso.set({ tipo: 'error', texto: error.error?.mensaje || 'No fue posible enviar la evaluación.' });
        this.guardando.set(false);
      },
    });
  }

  protected salir(): void {
    this.auth.logout();
  }
}
