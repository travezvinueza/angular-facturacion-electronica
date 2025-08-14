import { Component } from '@angular/core';
import { NgxUiLoaderModule } from 'ngx-ui-loader';

@Component({
  selector: 'app-loading',
  imports: [NgxUiLoaderModule],
  template: ` 
  <ngx-ui-loader
  bgsColor="#ffcc48"
  fgsColor="#004F4F"
  pbColor="#b12bf7"
  fgsType="square-jelly-box"
  text="Loading..."
  textColor="white">
  </ngx-ui-loader> `,
})

export class Loading {

}
