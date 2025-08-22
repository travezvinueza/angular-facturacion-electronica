import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Ubi } from './ubi';

describe('Ubi', () => {
  let component: Ubi;
  let fixture: ComponentFixture<Ubi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ubi]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Ubi);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
