import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
    const loaderTracker = inject(LoadingService);

    // Verificar si debe skipear el loading
    const skipLoader = req.headers.has('X-Skip-Loader');

    // Solo iniciar loading si no debe skipearlo
    if (!skipLoader) {
        loaderTracker.onRequestStart();
    }

    return next(req).pipe(
        finalize(() => {
            // Solo terminar loading si se había iniciado
            if (!skipLoader) {
                loaderTracker.onRequestEnd();
            }
        })
    );
};
