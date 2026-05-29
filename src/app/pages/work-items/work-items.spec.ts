import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkItemsComponent } from './work-items';

describe('WorkItems', () => {
  let component: WorkItemsComponent;
  let fixture: ComponentFixture<WorkItemsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkItemsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkItemsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
