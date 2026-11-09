import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut } from '@ng-icons/lucide';
import { AuthService } from '../../services/auth.service';
import { Sugerencia, SugerenciasService } from '../../services/sugerencias.service';

@Component({
  selector: 'app-sugerencias-admin',
  standalone: true,
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ lucideLogOut })],
  templateUrl: './sugerencias-admin.component.html',
})
export class SugerenciasAdminComponent implements OnInit {
  private readonly sugerenciasApi = inject(SugerenciasService);
  private readonly auth = inject(AuthService);

  protected readonly usuario = this.auth.getUsuario();
  protected readonly sugerencias = signal<Sugerencia[]>([]);
  protected readonly cargando = signal(true);
  protected readonly aviso = signal<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  ngOnInit(): void {
    this.sugerenciasApi.obtenerTodas().subscribe({
      next: ({ sugerencias }) => {
        this.sugerencias.set(sugerencias);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.aviso.set({ tipo: 'error', texto: error.error?.mensaje || 'No se pudieron cargar los mensajes.' });
        this.cargando.set(false);
      },
    });
  }

  protected fecha(value: string): string {
    return new Date(value).toLocaleString('es-GT', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Guatemala',
    });
  }

  protected tipo(value: string): string {
    const etiquetas: Record<string, string> = { SUGERENCIA: 'Sugerencia', QUEJA: 'Queja', OTRO: 'Otro' };
    return etiquetas[value] || value;
  }

  protected anonima(value: boolean | number): boolean {
    return value === true || Number(value) === 1;
  }

  protected salir(): void {
    this.auth.logout();
  }
}
