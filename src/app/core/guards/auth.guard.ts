import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
if (inject(AuthService).isAuthenticated()) {
    return true;
  }else{
    inject(Router).navigate(['/auth/login'])
    return false
  }
};
