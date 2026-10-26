import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowDownToLine, lucideArrowRight, lucideLogOut, lucidePencil, lucidePlus, lucideX } from '@ng-icons/lucide';
import { Marcacion } from '../../services/asistencia.service';
import { AuthService } from '../../services/auth.service';
import { DatosCorreccion, DatosIncidencia, EmpleadoRrhh, FiltrosAsistencia, RrhhService } from '../../services/rrhh.service';

interface EmpleadoOpcion {
  id: number;
  codigo: string;
  nombre: string;
}

@Component({
  selector: 'app-rrhh-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgIcon],
  providers: [provideIcons({ lucideArrowDownToLine, lucideArrowRight, lucideLogOut, lucidePencil, lucidePlus, lucideX })],
  templateUrl: './rrhh-dashboard.component.html',
})
export class RrhhDashboardComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly rrhh = inject(RrhhService);
  private readonly auth = inject(AuthService);

  protected readonly usuario = this.auth.getUsuario();
  protected readonly asistencias = signal<Marcacion[]>([]);
  protected readonly empleados = signal<EmpleadoRrhh[]>([]);
  protected readonly cargando = signal(false);
  protected readonly modal = signal<'correccion' | 'incidencia' | null>(null);
  protected readonly seleccionada = signal<Marcacion | null>(null);
  protected readonly guardando = signal(false);
  protected readonly exportando = signal(false);
  protected readonly aviso = signal<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  protected readonly filtros = this.formBuilder.nonNullable.group({
    busqueda: [''],
    fecha_inicio: [''],
    fecha_fin: [''],
  });
  protected readonly correccionForm = this.formBuilder.nonNullable.group({
    campo: ['hora_entrada' as 'hora_entrada' | 'hora_salida', Validators.required],
    hora: ['', Validators.required],
    motivo: ['', [Validators.required, Validators.minLength(4)]],
  });
  protected readonly incidenciaForm = this.formBuilder.nonNullable.group({
    empleado_id: ['', Validators.required],
    fecha_inicio: ['', Validators.required],
    fecha_fin: ['', Validators.required],
    tipo: ['permiso_oficial' as DatosIncidencia['tipo'], Validators.required],
    motivo: ['', [Validators.required, Validators.minLength(4)]],
  });

  ngOnInit(): void {
    this.cargarAsistencias();
    this.rrhh.obtenerEmpleados().subscribe({
      next: ({ empleados }) => this.empleados.set(empleados),
      error: () => this.empleados.set([]),
    });
  }

  protected buscar(): void {
    this.cargarAsistencias();
  }

  protected limpiarFiltros(): void {
    this.filtros.reset({ busqueda: '', fecha_inicio: '', fecha_fin: '' });
    this.cargarAsistencias();
  }

  protected abrirCorreccion(item: Marcacion): void {
    this.seleccionada.set(item);
    this.correccionForm.reset({ campo: 'hora_entrada', hora: '', motivo: '' });
    this.modal.set('correccion');
  }

  protected abrirIncidencia(): void {
    this.incidenciaForm.reset({ empleado_id: '', fecha_inicio: '', fecha_fin: '', tipo: 'permiso_oficial', motivo: '' });
    this.modal.set('incidencia');
  }

  protected cerrarModal(): void {
    if (!this.guardando()) this.modal.set(null);
  }

  protected guardarCorreccion(): void {
    this.correccionForm.markAllAsTouched();
    const item = this.seleccionada();
    if (this.correccionForm.invalid || !item || this.guardando()) return;

    const value = this.correccionForm.getRawValue();
    const datos: DatosCorreccion = {
      marcacion_id: item.id,
      motivo: value.motivo.trim(),
      [value.campo]: value.hora.replace('T', ' '),
    };
    this.guardando.set(true);
    this.rrhh.corregirMarcacion(datos).subscribe({
      next: (response) => {
        this.aviso.set({ tipo: 'success', texto: response.mensaje });
        this.modal.set(null);
        this.guardando.set(false);
        this.cargarAsistencias();
      },
      error: (error: HttpErrorResponse) => this.errorOperacion(error),
    });
  }

  protected guardarIncidencia(): void {
    this.incidenciaForm.markAllAsTouched();
    if (this.incidenciaForm.invalid || this.guardando()) return;

    const value = this.incidenciaForm.getRawValue();
    if (value.fecha_inicio > value.fecha_fin) {
      this.aviso.set({ tipo: 'error', texto: 'La fecha inicial debe ser anterior a la fecha final.' });
      return;
    }
    const datos: DatosIncidencia = {
      ...value,
      empleado_id: Number(value.empleado_id),
      motivo: value.motivo.trim(),
    };
    this.guardando.set(true);
    this.rrhh.registrarIncidencia(datos).subscribe({
      next: (response) => {
        this.aviso.set({ tipo: 'success', texto: response.mensaje });
        this.modal.set(null);
        this.guardando.set(false);
      },
      error: (error: HttpErrorResponse) => this.errorOperacion(error),
    });
  }

  protected exportar(): void {
    if (this.exportando()) return;
    this.exportando.set(true);
    this.rrhh.descargarExcel(this.obtenerFiltros()).subscribe({
      next: (archivo) => {
        const url = URL.createObjectURL(archivo);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = 'reporte-simet.xlsx';
        enlace.click();
        URL.revokeObjectURL(url);
        this.exportando.set(false);
      },
      error: (error: HttpErrorResponse) => this.errorOperacion(error),
    });
  }

  protected formatoFecha(fecha: string): string {
    return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-GT', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Guatemala',
    });
  }

  protected hora(value: string | null): string {
    return value ? value.slice(11, 16) : '—';
  }

  protected etiquetaEstado(estado: string | null): string {
    const etiquetas: Record<string, string> = { puntual: 'Puntual', atraso: 'Atraso', normal: 'Normal', anticipada: 'Anticipada' };
    return estado ? etiquetas[estado] || estado : 'Pendiente';
  }

  protected salir(): void {
    this.auth.logout();
  }

  private obtenerFiltros(): FiltrosAsistencia {
    const value = this.filtros.getRawValue();
    return { busqueda: value.busqueda.trim(), fecha_inicio: value.fecha_inicio, fecha_fin: value.fecha_fin };
  }

  private cargarAsistencias(): void {
    this.cargando.set(true);
    this.rrhh.obtenerAsistencias(this.obtenerFiltros()).subscribe({
      next: ({ asistencias }) => {
        this.asistencias.set(asistencias);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);
        this.aviso.set({ tipo: 'error', texto: error.error?.mensaje || 'No se pudo cargar el reporte.' });
      },
    });
  }

  private errorOperacion(error: HttpErrorResponse): void {
    this.aviso.set({ tipo: 'error', texto: error.error?.mensaje || 'No fue posible completar la operación.' });
    this.guardando.set(false);
    this.exportando.set(false);
  }
}