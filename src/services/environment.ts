/**
 * Authoritative Environment Configuration Engine
 * Enforces strict environment separation between Development, Staging, and Production.
 * In Production mode: Zero demo/mock/seed/placeholder data is permitted at any time.
 */

export type AppEnvironment = 'development' | 'staging' | 'production';

export class EnvironmentService {
  private static instance: EnvironmentService;
  private currentEnv: AppEnvironment;

  private constructor() {
    this.currentEnv = this.detectEnvironment();
    this.logEnvironmentStatus();
  }

  public static getInstance(): EnvironmentService {
    if (!EnvironmentService.instance) {
      EnvironmentService.instance = new EnvironmentService();
    }
    return EnvironmentService.instance;
  }

  private detectEnvironment(): AppEnvironment {
    // 1. Explicit environment variable check
    const explicitEnv = import.meta.env.VITE_APP_ENV as string | undefined;
    if (explicitEnv === 'production') return 'production';
    if (explicitEnv === 'staging') return 'staging';
    if (explicitEnv === 'development') return 'development';

    // 2. Vite production build flag
    if (import.meta.env.PROD || import.meta.env.MODE === 'production') {
      return 'production';
    }

    // 3. Browser host analysis
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname.toLowerCase();
      
      // Local development machine
      if ((hostname === 'localhost' || hostname === '127.0.0.1') && import.meta.env.DEV) {
        return 'development';
      }

      // Shared preview deployment or custom production domain
      if (hostname.includes('ais-pre-') || hostname.includes('theunbound') || !hostname.includes('ais-dev-')) {
        return 'production';
      }
    }

    // 4. Default: Production for all non-local runs (Fail-Safe)
    return import.meta.env.DEV ? 'development' : 'production';
  }

  public getEnvironment(): AppEnvironment {
    return this.currentEnv;
  }

  public isProduction(): boolean {
    return this.currentEnv === 'production';
  }

  public isStaging(): boolean {
    return this.currentEnv === 'staging';
  }

  public isDevelopment(): boolean {
    return this.currentEnv === 'development';
  }

  /**
   * Authoritative Demo Data Gate:
   * Demo, mock, seed, and placeholder records are ONLY permitted if:
   * 1. Environment is explicitly 'development'
   * 2. AND we are running in Vite DEV mode
   * 3. AND running on localhost / 127.0.0.1
   * 
   * In Production / Staging, this ALWAYS returns false.
   */
  public allowDemoData(): boolean {
    if (this.currentEnv === 'production' || this.currentEnv === 'staging') {
      return false;
    }
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.toLowerCase();
      if (host !== 'localhost' && host !== '127.0.0.1') {
        return false;
      }
    }
    return Boolean(import.meta.env.DEV);
  }

  private logEnvironmentStatus(): void {
    if (this.isProduction()) {
      console.info(
        `%c[ENVIRONMENT] PRODUCTION MODE ACTIVE%c — Single Source of Truth: Firebase/Firestore. Zero demo data permitted.`,
        'background: #008972; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
        'color: inherit;'
      );
    } else {
      console.info(`[ENVIRONMENT] Running in ${this.currentEnv.toUpperCase()} mode.`);
    }
  }
}

export const envService = EnvironmentService.getInstance();
