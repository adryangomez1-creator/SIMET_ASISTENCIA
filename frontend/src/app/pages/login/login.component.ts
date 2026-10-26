import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight } from '@ng-icons/lucide';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, NgIcon],
  providers: [provideIcons({ lucideArrowRight })],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly formulario = this.formBuilder.nonNullable.group({
    codigo_empleado: ['', Validators.required],
    password: ['', Validators.required],
  });

  constructor() {
    if (this.auth.isAuthenticated()) this.irAlPanel();
  }

  protected ingresar(): void {
    this.error.set('');
    if (this.formulario.invalid || this.enviando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    const { codigo_empleado, password } = this.formulario.getRawValue();
    this.auth.login(codigo_empleado.trim(), password).subscribe({
      next: () => this.irAlPanel(),
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.mensaje || 'No fue posible iniciar sesión. Verifica tus datos.');
        this.enviando.set(false);
      },
    });
  }

  private irAlPanel(): void {
    void this.router.navigate([this.auth.hasRrhhRole() ? '/rrhh' : '/dashboard']);
  }
}