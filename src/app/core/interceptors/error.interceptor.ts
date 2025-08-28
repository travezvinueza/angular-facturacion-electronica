import type { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const msgService = inject(MessageService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        msgService.add({ severity: 'error', summary: 'Error', detail: 'Sin conexión con el servidor.' });
      } else if (error.error?.Message) {
        msgService.add({severity: 'error', summary: 'Error en el servidor.', detail:error.error.Message});
      } else {
        msgService.add({ severity: 'error', summary: 'Error', detail: 'Error de validación.' });
      }
      return throwError(() => error);
    })
  );
};
