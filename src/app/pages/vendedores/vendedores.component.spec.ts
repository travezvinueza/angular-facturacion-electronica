import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VendedoresComponent } from './vendedores.component';

describe('VendedoresComponent', () => {
  let component: VendedoresComponent;
  let fixture: ComponentFixture<VendedoresComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VendedoresComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VendedoresComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
