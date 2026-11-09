import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut } from '@ng-icons/lucide';
import { AuthService } from '../../services/auth.service';
import { SugerenciasService } from '../../services/sugerencias.service';

@Component({
  selector: 'app-sugerencias',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgIcon],
  providers: [provideIcons({ lucideLogOut })],
  templateUrl: './sugerencias.component.html',
})
export class SugerenciasComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly sugerenciasApi = inject(SugerenciasService);
  private readonly auth = inject(AuthService);

  protected readonly usuario = this.auth.getUsuario();
  protected readonly enviando = signal(false);
  protected readonly aviso = signal<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  protected readonly formulario = this.formBuilder.nonNullable.group({
    tipo: ['SUGERENCIA' as 'SUGERENCIA' | 'QUEJA' | 'OTRO', Validators.required],
    contenido: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(5000)]],
    anonima: [false],
  });

  protected enviar(): void {
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.enviando()) return;

    const datos = this.formulario.getRawValue();
    this.enviando.set(true);
    this.aviso.set(null);
    this.sugerenciasApi.crear(datos).subscribe({
      next: ({ mensaje }) => {
        this.aviso.set({ tipo: 'success', texto: mensaje });
        this.formulario.reset({ tipo: 'SUGERENCIA', contenido: '', anonima: false });
        this.enviando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.aviso.set({ tipo: 'error', texto: error.error?.mensaje || 'No fue posible enviar el mensaje.' });
        this.enviando.set(false);
      },
    });
  }

  protected salir(): void {
    this.auth.logout();
  }
}
