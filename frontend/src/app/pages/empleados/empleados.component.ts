import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut } from '@ng-icons/lucide';
import { AuthService } from '../../services/auth.service';
import { EmpleadoRrhh, RrhhService } from '../../services/rrhh.service';

@Component({
  selector: 'app-empleados',
  standalone: true,
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ lucideLogOut })],
  templateUrl: './empleados.component.html',
})
export class EmpleadosComponent implements OnInit {
  private readonly rrhh = inject(RrhhService);
  private readonly auth = inject(AuthService);

  protected readonly usuario = this.auth.getUsuario();
  protected readonly empleados = signal<EmpleadoRrhh[]>([]);
  protected readonly busqueda = signal('');
  protected readonly cargando = signal(true);
  protected readonly aviso = signal('');

  ngOnInit(): void {
    this.rrhh.obtenerEmpleados().subscribe({
      next: ({ empleados }) => {
        this.empleados.set(empleados);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.aviso.set(error.error?.mensaje || 'No se pudo cargar el directorio de empleados.');
        this.cargando.set(false);
      },
    });
  }

  protected filtrar(event: Event): void {
    this.busqueda.set((event.target as HTMLInputElement).value.trim().toLocaleLowerCase());
  }

  protected empleadosFiltrados(): EmpleadoRrhh[] {
    const termino = this.busqueda();
    return this.empleados().filter((empleado) =>
      `${empleado.nombre} ${empleado.codigo_empleado} ${empleado.nombre_puesto} ${empleado.nombre_rol}`
        .toLocaleLowerCase()
        .includes(termino),
    );
  }

  protected salir(): void {
    this.auth.logout();
  }
}
