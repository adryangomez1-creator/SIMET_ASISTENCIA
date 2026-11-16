import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut } from '@ng-icons/lucide';
import { AuthService } from '../../services/auth.service';
import { ExamenesAspirantesService, PreguntaExamen } from '../../services/examenes-aspirantes.service';

@Component({
  selector: 'app-examen-aspirante',
  standalone: true,
  imports: [ReactiveFormsModule, NgIcon],
  providers: [provideIcons({ lucideLogOut })],
  templateUrl: './examen-aspirante.component.html',
  styleUrl: './examen-aspirante.component.css',
})
export class ExamenAspiranteComponent implements OnInit, OnDestroy {
  private readonly api = inject(ExamenesAspirantesService);
  private readonly auth = inject(AuthService);
  private cierreSesionTimer: number | null = null;

  protected readonly usuario = this.auth.getUsuario();
  protected readonly titulo = signal('');
  protected readonly preguntas = signal<PreguntaExamen[]>([]);
  protected readonly respuestas = new FormRecord<FormControl<string>>({});
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly resultado = signal<{
    mensaje: string;
    puntaje_automatico: number;
    puntaje_maximo: number;
    pendiente_revision: boolean;
  } | null>(null);
  protected readonly aviso = signal<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  ngOnInit(): void {
    this.api.obtenerMiExamen().subscribe({
      next: ({ examen, preguntas }) => {
        this.titulo.set(examen.titulo);
        this.preguntas.set(preguntas);
        for (const pregunta of preguntas) {
          this.respuestas.addControl(
            String(pregunta.id),
            new FormControl('', {
              nonNullable: true,
              validators: [Validators.required, Validators.maxLength(5000)],
            }),
          );
        }
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);
        if (error.status === 403) {
          this.auth.logout();
          return;
        }
        this.aviso.set({ tipo: 'error', texto: error.error?.mensaje || 'No se pudo cargar el examen asignado.' });
      },
    });
  }

  ngOnDestroy(): void {
    if (this.cierreSesionTimer !== null) window.clearTimeout(this.cierreSesionTimer);
  }

  protected control(preguntaId: number): FormControl<string> {
    return this.respuestas.controls[String(preguntaId)];
  }

  protected secciones(): string[] {
    return [...new Set(this.preguntas().map((pregunta) => pregunta.section))];
  }

  protected preguntasPorSeccion(seccion: string): PreguntaExamen[] {
    return this.preguntas().filter((pregunta) => pregunta.section === seccion);
  }

  protected opcionValue(index: number): string {
    return String(index + 1);
  }

  protected formatoPuntaje(value: number | string): string {
    return Number(value).toFixed(2);
  }

  protected enviar(): void {
    this.respuestas.markAllAsTouched();
    if (this.respuestas.invalid || !this.preguntas().length || this.guardando() || this.resultado()) return;

    const respuestas = this.preguntas().map((pregunta) => {
      const value = this.control(pregunta.id).value.trim();
      return pregunta.question_type === 'MULTIPLE_CHOICE'
        ? { question_id: pregunta.id, selected_option: Number(value) }
        : { question_id: pregunta.id, response_text: value };
    });

    this.guardando.set(true);
    this.aviso.set(null);
    this.api.enviarRespuestas(respuestas).subscribe({
      next: (resultado) => {
        this.resultado.set(resultado);
        this.guardando.set(false);
        this.cierreSesionTimer = window.setTimeout(() => this.auth.logout(), 10000);
      },
      error: (error: HttpErrorResponse) => {
        this.aviso.set({ tipo: 'error', texto: error.error?.mensaje || 'No fue posible enviar el examen.' });
        this.guardando.set(false);
      },
    });
  }

  protected salir(): void {
    this.auth.logout();
  }
}
