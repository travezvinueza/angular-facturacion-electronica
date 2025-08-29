import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnlyGeocercasComponent } from './only-geocercas.component';

describe('Onlygeocercas', () => {
  let component: OnlyGeocercasComponent;
  let fixture: ComponentFixture<OnlyGeocercasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnlyGeocercasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OnlyGeocercasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
