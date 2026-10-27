import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideLogOut } from '@ng-icons/lucide';
import { interval } from 'rxjs';
import { AsistenciaService, Marcacion, ResultadoMarcacion } from '../../services/asistencia.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-empleado-dashboard',
  standalone: true,
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ lucideArrowRight, lucideLogOut })],
  templateUrl: './empleado-dashboard.component.html',
})
export class EmpleadoDashboardComponent implements OnInit {
  private readonly asistencia = inject(AsistenciaService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly usuario = this.auth.getUsuario();
  protected readonly horaActual = signal('');
  protected readonly fechaActual = signal('');
  protected readonly historial = signal<Marcacion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly marcando = signal(false);
  protected readonly aviso = signal<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('acceso') === 'denegado') {
      this.aviso.set({ tipo: 'error', texto: 'Acceso denegado. Esta sección es exclusiva para administradores.' });
    }
    this.actualizarReloj();
    interval(1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.actualizarReloj());
    this.cargarHistorial();
  }

  protected registrar(): void {
    if (this.marcando()) return;
    this.marcando.set(true);
    this.aviso.set(null);
    this.asistencia.registrarMarcacion().subscribe({
      next: (resultado: ResultadoMarcacion) => {
        const accion = resultado.tipo === 'entrada' ? 'Entrada' : 'Salida';
        const estado = this.etiquetaEstado(resultado.estado);
        this.aviso.set({ tipo: 'success', texto: `${accion} registrada: ${estado} · ${resultado.hora.slice(11, 16)}` });
        this.marcando.set(false);
        this.cargarHistorial();
      },
      error: (error: HttpErrorResponse) => {
        this.aviso.set({ tipo: 'error', texto: error.error?.mensaje || 'No se pudo registrar la marcación.' });
        this.marcando.set(false);
      },
    });
  }

  protected salir(): void {
    this.auth.logout();
  }

  protected abrirRrhh(): void {
    void this.router.navigate(['/rrhh']);
  }

  protected etiquetaEstado(estado: string | null): string {
    const etiquetas: Record<string, string> = {
      puntual: 'Puntual', atraso: 'Atraso', normal: 'Salida normal', anticipada: 'Salida anticipada',
    };
    return estado ? etiquetas[estado] || estado : 'Pendiente';
  }

  protected formatoFecha(fecha: string): string {
    return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-GT', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Guatemala',
    });
  }

  private cargarHistorial(): void {
    this.cargando.set(true);
    this.asistencia.obtenerHistorial().subscribe({
      next: ({ marcaciones }) => {
        this.historial.set(marcaciones);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  private actualizarReloj(): void {
    const ahora = new Date();
    this.horaActual.set(new Intl.DateTimeFormat('es-GT', {
      timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(ahora));
    this.fechaActual.set(new Intl.DateTimeFormat('es-GT', {
      timeZone: 'America/Guatemala', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(ahora));
  }
}