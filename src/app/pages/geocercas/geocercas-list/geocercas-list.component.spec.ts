import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeocercasListComponent } from './geocercas-list.component';

describe('Geocercas', () => {
  let component: GeocercasListComponent;
  let fixture: ComponentFixture<GeocercasListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeocercasListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GeocercasListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
