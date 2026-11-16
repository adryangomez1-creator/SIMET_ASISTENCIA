import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CredencialesAspirante,
  DetalleEnvio,
  EnvioExamen,
  ExamenAspirante,
  ExamenesAspirantesService,
  RespuestaRevision,
} from '../../services/examenes-aspirantes.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-examenes-aspirantes',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './examenes-aspirantes.component.html',
  styleUrl: './examenes-aspirantes.component.css',
})
export class ExamenesAspirantesComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(ExamenesAspirantesService);
  private readonly auth = inject(AuthService);

  protected readonly usuario = this.auth.getUsuario();
  protected readonly examenes = signal<ExamenAspirante[]>([]);
  protected readonly envios = signal<EnvioExamen[]>([]);
  protected readonly revision = signal<DetalleEnvio | null>(null);
  protected readonly credenciales = signal<CredencialesAspirante | null>(null);
  protected readonly puntajes = signal<Record<number, string>>({});
  protected readonly comentarios = signal<Record<number, string>>({});
  protected readonly cargando = signal(true);
  protected readonly cargandoRevision = signal(false);
  protected readonly guardando = signal(false);
  protected readonly aviso = signal<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  protected readonly formulario = this.formBuilder.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    correo: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    exam_id: ['', Validators.required],
  });

  ngOnInit(): void {
    this.api.obtenerExamenes().subscribe({
      next: ({ examenes }) => {
        this.examenes.set(examenes);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => this.mostrarError(error, 'No se pudieron cargar los exámenes.'),
    });
    this.cargarEnvios();
  }

  protected generarAcceso(): void {
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.guardando()) return;

    const value = this.formulario.getRawValue();
    this.guardando.set(true);
    this.aviso.set(null);
    this.credenciales.set(null);
    this.api.generarAspirante({
      nombre: value.nombre.trim(),
      correo: value.correo.trim(),
      exam_id: Number(value.exam_id),
    }).subscribe({
      next: ({ mensaje, credenciales }) => {
        this.credenciales.set(credenciales);
        this.aviso.set({ tipo: 'success', texto: mensaje });
        this.formulario.reset({ nombre: '', correo: '', exam_id: '' });
        this.guardando.set(false);
        this.cargarEnvios();
      },
      error: (error: HttpErrorResponse) => this.mostrarError(error, 'No fue posible generar las credenciales.'),
    });
  }

  protected abrirRevision(envio: EnvioExamen): void {
    this.cargandoRevision.set(true);
    this.revision.set(null);
    this.puntajes.set({});
    this.comentarios.set({});
    this.api.obtenerEnvio(envio.id).subscribe({
      next: (detalle) => {
        const puntajes: Record<number, string> = {};
        const comentarios: Record<number, string> = {};
        for (const respuesta of detalle.respuestas) {
          if (respuesta.question_type === 'OPEN_TEXT') {
            puntajes[respuesta.answer_id] = respuesta.awarded_score === null ? '' : String(respuesta.awarded_score);
            comentarios[respuesta.answer_id] = respuesta.reviewer_comment || '';
          }
        }
        this.revision.set(detalle);
        this.puntajes.set(puntajes);
        this.comentarios.set(comentarios);
        this.cargandoRevision.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.cargandoRevision.set(false);
        this.mostrarError(error, 'No se pudo cargar el examen completo.');
      },
    });
  }

  protected actualizarPuntaje(answerId: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.puntajes.update((puntajes) => ({ ...puntajes, [answerId]: value }));
  }

  protected actualizarComentario(answerId: number, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.comentarios.update((comentarios) => ({ ...comentarios, [answerId]: value }));
  }

  protected guardarRevision(): void {
    const detalle = this.revision();
    if (!detalle || this.guardando()) return;

    const respuestasAbiertas = detalle.respuestas.filter((respuesta) => respuesta.question_type === 'OPEN_TEXT');
    const respuestas = [];
    for (const respuesta of respuestasAbiertas) {
      const puntaje = this.puntajes()[respuesta.answer_id];
      const valor = Number(puntaje);
      if (puntaje === '' || !Number.isFinite(valor) || valor < 0 || valor > Number(respuesta.max_score)) {
        this.aviso.set({
          tipo: 'error',
          texto: `Asigna a cada respuesta abierta un puntaje entre 0 y ${Number(respuesta.max_score).toFixed(2)}.`,
        });
        return;
      }
      respuestas.push({
        answer_id: respuesta.answer_id,
        score: valor,
        comment: this.comentarios()[respuesta.answer_id] || '',
      });
    }

    this.guardando.set(true);
    this.aviso.set(null);
    this.api.guardarRevision(detalle.envio.id, respuestas).subscribe({
      next: ({ mensaje, puntaje_final }) => {
        this.aviso.set({ tipo: 'success', texto: `${mensaje} Puntaje final: ${puntaje_final.toFixed(2)}.` });
        this.guardando.set(false);
        this.revision.set(null);
        this.cargarEnvios();
      },
      error: (error: HttpErrorResponse) => this.mostrarError(error, 'No se pudo guardar la revisión.'),
    });
  }

  protected cerrarRevision(): void {
    this.revision.set(null);
  }

  protected respuestasAbiertas(respuestas: RespuestaRevision[]): RespuestaRevision[] {
    return respuestas.filter((respuesta) => respuesta.question_type === 'OPEN_TEXT');
  }

  protected opcion(respuesta: RespuestaRevision): string {
    if (!respuesta.options || !respuesta.selected_option) return 'Sin opción';
    const seleccionada = respuesta.options[respuesta.selected_option - 1] || 'Opción no disponible';
    const correcta = respuesta.options[(respuesta.correct_option || 0) - 1] || 'Opción no disponible';
    return `Seleccionada: ${seleccionada} · Correcta: ${correcta}`;
  }

  protected puntaje(respuesta: RespuestaRevision): string {
    return respuesta.awarded_score === null
      ? 'Pendiente'
      : `${Number(respuesta.awarded_score).toFixed(2)} / ${Number(respuesta.max_score).toFixed(2)}`;
  }

  protected fecha(value: string): string {
    return new Date(value).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
  }

  protected formatoPuntaje(value: number | string | null): string {
    return Number(value || 0).toFixed(2);
  }

  protected async copiar(texto: string, campo: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
      this.aviso.set({ tipo: 'success', texto: `${campo} copiado al portapapeles.` });
    } catch {
      this.aviso.set({ tipo: 'error', texto: 'No se pudo copiar. Selecciona y copia el dato manualmente.' });
    }
  }

  protected salir(): void {
    this.auth.logout();
  }

  private cargarEnvios(): void {
    this.api.obtenerEnvios().subscribe({
      next: ({ envios }) => this.envios.set(envios),
      error: (error: HttpErrorResponse) => this.mostrarError(error, 'No se pudieron cargar los exámenes enviados.'),
    });
  }

  private mostrarError(error: HttpErrorResponse, respaldo: string): void {
    this.aviso.set({ tipo: 'error', texto: error.error?.mensaje || respaldo });
    this.cargando.set(false);
    this.cargandoRevision.set(false);
    this.guardando.set(false);
  }
}
