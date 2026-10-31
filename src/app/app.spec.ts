import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { createAuthStub } from '../testing/auth-stub';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: AuthService, useValue: createAuthStub() }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renderiza la estructura principal: topbar, contenido y navegación móvil', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('app-topbar')).toBeTruthy();
    expect(element.querySelector('main#main')).toBeTruthy();
    expect(element.querySelectorAll('nav[aria-label="Principal"]')).toHaveLength(2);
    expect(element.querySelector('app-confirm-dialog dialog')).toBeTruthy();
  });
});
