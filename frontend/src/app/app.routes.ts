import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { EmpleadoDashboardComponent } from './pages/empleado-dashboard/empleado-dashboard.component';
import { LoginComponent } from './pages/login/login.component';
import { RrhhDashboardComponent } from './pages/rrhh-dashboard/rrhh-dashboard.component';

export const routes: Routes = [
	{ path: 'login', component: LoginComponent },
	{ path: 'dashboard', component: EmpleadoDashboardComponent, canActivate: [authGuard] },
	{ path: 'rrhh', component: RrhhDashboardComponent, canActivate: [authGuard, roleGuard] },
	{ path: '', pathMatch: 'full', redirectTo: 'login' },
	{ path: '**', redirectTo: 'login' },
];
