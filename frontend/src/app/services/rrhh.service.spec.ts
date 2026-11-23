import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { RrhhService } from './rrhh.service';

describe('RrhhService', () => {
  let service: RrhhService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RrhhService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      httpTesting.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('sends filters and pagination for attendance requests', () => {
    service.obtenerAsistencias(
      { busqueda: 'SIMET', fecha_inicio: '2026-01-01', fecha_fin: '2026-01-31' },
      2,
    ).subscribe();

    const request = httpTesting.expectOne((candidate) =>
      candidate.url === `${environment.apiUrl}/rrhh/asistencias`);
    expect(request.request.params.get('codigo_empleado')).toBe('SIMET');
    expect(request.request.params.get('fecha_inicio')).toBe('2026-01-01');
    expect(request.request.params.get('fecha_fin')).toBe('2026-01-31');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('page_size')).toBe('25');
    request.flush({
      asistencias: [],
      paginacion: { pagina: 2, por_pagina: 25, total: 26, total_paginas: 2 },
    });
  });

  it('keeps Excel exports unpaginated while preserving their filters', () => {
    service.descargarExcel({ busqueda: 'SIMET', fecha_inicio: '2026-01-01' }).subscribe();

    const request = httpTesting.expectOne((candidate) =>
      candidate.url === `${environment.apiUrl}/rrhh/exportar-excel`);
    expect(request.request.params.get('codigo_empleado')).toBe('SIMET');
    expect(request.request.params.get('fecha_inicio')).toBe('2026-01-01');
    expect(request.request.params.has('page')).toBe(false);
    expect(request.request.params.has('page_size')).toBe(false);
    request.flush(new Blob());
  });
});
