import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { aspiranteGuard } from './guards/aspirante.guard';
import { adminGuard } from './guards/admin.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
	{ path: 'login', loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent) },
	{ path: 'examen-aspirante', loadComponent: () => import('./pages/examen-aspirante/examen-aspirante.component').then((m) => m.ExamenAspiranteComponent), canActivate: [aspiranteGuard] },
	{ path: 'dashboard', loadComponent: () => import('./pages/empleado-dashboard/empleado-dashboard.component').then((m) => m.EmpleadoDashboardComponent), canActivate: [authGuard] },
	{ path: 'rrhh', loadComponent: () => import('./pages/rrhh-dashboard/rrhh-dashboard.component').then((m) => m.RrhhDashboardComponent), canActivate: [authGuard, roleGuard] },
	{ path: 'admin/evaluaciones', loadComponent: () => import('./pages/evaluacion-personal/evaluacion-personal.component').then((m) => m.EvaluacionPersonalComponent), canActivate: [adminGuard] },
	{ path: 'admin/examenes-aspirantes', loadComponent: () => import('./pages/examenes-aspirantes/examenes-aspirantes.component').then((m) => m.ExamenesAspirantesComponent), canActivate: [adminGuard] },
	{ path: 'admin/empleados', loadComponent: () => import('./pages/empleados/empleados.component').then((m) => m.EmpleadosComponent), canActivate: [adminGuard] },
	{ path: 'admin/sugerencias', loadComponent: () => import('./pages/sugerencias-admin/sugerencias-admin.component').then((m) => m.SugerenciasAdminComponent), canActivate: [adminGuard] },
	{ path: 'mi-evaluacion', loadComponent: () => import('./pages/empleado-evaluacion/empleado-evaluacion.component').then((m) => m.EmpleadoEvaluacionComponent), canActivate: [authGuard] },
	{ path: 'sugerencias', loadComponent: () => import('./pages/sugerencias/sugerencias.component').then((m) => m.SugerenciasComponent), canActivate: [authGuard] },
	{ path: '', pathMatch: 'full', redirectTo: 'login' },
	{ path: '**', redirectTo: 'login' },
];
