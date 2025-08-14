import { Injectable } from '@angular/core';
import { NgxUiLoaderService } from 'ngx-ui-loader';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {

 private requestCount = 0; //iniciamos en 0 contador de peticiones

  constructor(private readonly loader: NgxUiLoaderService) {}

  onRequestStart(): void {
    this.requestCount++;
    if (this.requestCount === 1) {
      this.loader.start(); // Start the spinner only on the first request
    }
  }

  onRequestEnd(): void {
    this.requestCount--;
    if (this.requestCount === 0) {
      this.loader.stop(); // Stop the spinner when no requests are left
    }
  }

}
