import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { aspiranteGuard } from './guards/aspirante.guard';
import { adminGuard } from './guards/admin.guard';
import { roleGuard } from './guards/role.guard';
import { EmpleadoDashboardComponent } from './pages/empleado-dashboard/empleado-dashboard.component';
import { EmpleadoEvaluacionComponent } from './pages/empleado-evaluacion/empleado-evaluacion.component';
import { EmpleadosComponent } from './pages/empleados/empleados.component';
import { ExamenAspiranteComponent } from './pages/examen-aspirante/examen-aspirante.component';
import { ExamenesAspirantesComponent } from './pages/examenes-aspirantes/examenes-aspirantes.component';
import { EvaluacionPersonalComponent } from './pages/evaluacion-personal/evaluacion-personal.component';
import { LoginComponent } from './pages/login/login.component';
import { RrhhDashboardComponent } from './pages/rrhh-dashboard/rrhh-dashboard.component';
import { SugerenciasAdminComponent } from './pages/sugerencias-admin/sugerencias-admin.component';
import { SugerenciasComponent } from './pages/sugerencias/sugerencias.component';

export const routes: Routes = [
	{ path: 'login', component: LoginComponent },
	{ path: 'examen-aspirante', component: ExamenAspiranteComponent, canActivate: [aspiranteGuard] },
	{ path: 'dashboard', component: EmpleadoDashboardComponent, canActivate: [authGuard] },
	{ path: 'rrhh', component: RrhhDashboardComponent, canActivate: [authGuard, roleGuard] },
	{ path: 'admin/evaluaciones', component: EvaluacionPersonalComponent, canActivate: [adminGuard] },
	{ path: 'admin/examenes-aspirantes', component: ExamenesAspirantesComponent, canActivate: [adminGuard] },
	{ path: 'admin/empleados', component: EmpleadosComponent, canActivate: [adminGuard] },
	{ path: 'admin/sugerencias', component: SugerenciasAdminComponent, canActivate: [adminGuard] },
	{ path: 'mi-evaluacion', component: EmpleadoEvaluacionComponent, canActivate: [authGuard] },
	{ path: 'sugerencias', component: SugerenciasComponent, canActivate: [authGuard] },
	{ path: '', pathMatch: 'full', redirectTo: 'login' },
	{ path: '**', redirectTo: 'login' },
];
