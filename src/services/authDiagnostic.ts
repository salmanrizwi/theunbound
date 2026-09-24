/**
 * Dedicated Internal Authentication Diagnostic Instrumentation
 * Identifier: id="r0t3k7"
 * 
 * Tracks the complete Published login lifecycle across exact checkpoints:
 * T0 = Login button clicked
 * T1 = Firebase Auth request started
 * T2 = Firebase Auth response received
 * T3 = Auth UID resolved
 * T4 = Firestore User Profile request started
 * T5 = Firestore User Profile response received
 * T6 = Role resolved
 * T7 = Permission resolution completed
 * T8 = Company/Profile context loaded
 * T9 = Application initialization completed
 * T10 = Redirect started
 * T11 = Destination page loaded
 */

export interface AuthDiagnosticTimeline {
  id: string;
  email?: string;
  role?: string;
  t0?: number; // Login button clicked
  t1?: number; // Firebase Auth request started
  t2?: number; // Firebase Auth response received
  t3?: number; // Auth UID resolved
  t4?: number; // Firestore User Profile request started
  t5?: number; // Firestore User Profile response received
  t6?: number; // Role resolved
  t7?: number; // Permission resolution completed
  t8?: number; // Company/Profile context loaded
  t9?: number; // Application initialization completed
  t10?: number; // Redirect started
  t11?: number; // Destination page loaded
  errorStage?: string;
  errorMessage?: string;
  authUid?: string;
  status: 'IDLE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'TIMED_OUT';
}

class AuthDiagnosticService {
  private static instance: AuthDiagnosticService;
  private currentTimeline: AuthDiagnosticTimeline = {
    id: 'r0t3k7',
    status: 'IDLE'
  };

  private constructor() {
    if (typeof window !== 'undefined') {
      (window as any).__AUTH_DIAGNOSTIC_TIMELINE__ = this.currentTimeline;
      (window as any).__GET_AUTH_DIAGNOSTIC__ = () => this.getReport();
    }
  }

  public static getInstance(): AuthDiagnosticService {
    if (!AuthDiagnosticService.instance) {
      AuthDiagnosticService.instance = new AuthDiagnosticService();
    }
    return AuthDiagnosticService.instance;
  }

  public startLogin(email: string, role?: string): void {
    const now = performance.now();
    this.currentTimeline = {
      id: 'r0t3k7',
      email,
      role,
      t0: now,
      status: 'IN_PROGRESS'
    };
    if (typeof window !== 'undefined') {
      (window as any).__AUTH_DIAGNOSTIC_TIMELINE__ = this.currentTimeline;
    }
    console.info(`[AUTH-DIAGNOSTIC id="r0t3k7"] T0: Login button clicked for ${email} (Role: ${role || 'UNKNOWN'})`);
  }

  public markStage(
    stage: 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8' | 'T9' | 'T10' | 'T11',
    details?: { uid?: string; role?: string; error?: string; message?: string }
  ): void {
    const now = performance.now();
    const t0 = this.currentTimeline.t0 || now;
    const elapsedFromT0 = Math.round(now - t0);

    switch (stage) {
      case 'T1':
        this.currentTimeline.t1 = now;
        console.info(`[AUTH-DIAGNOSTIC id="r0t3k7"] T1: Firebase Auth request started (+${elapsedFromT0}ms)`);
        break;
      case 'T2':
        this.currentTimeline.t2 = now;
        console.info(`[AUTH-DIAGNOSTIC id="r0t3k7"] T2: Firebase Auth response received (+${elapsedFromT0}ms, ΔT1-T2=${this.currentTimeline.t1 ? Math.round(now - this.currentTimeline.t1) : 0}ms)`);
        break;
      case 'T3':
        this.currentTimeline.t3 = now;
        if (details?.uid) this.currentTimeline.authUid = details.uid;
        console.info(`[AUTH-DIAGNOSTIC id="r0t3k7"] T3: Auth UID resolved: ${details?.uid || 'NONE'} (+${elapsedFromT0}ms)`);
        break;
      case 'T4':
        this.currentTimeline.t4 = now;
        console.info(`[AUTH-DIAGNOSTIC id="r0t3k7"] T4: Firestore User Profile request started (+${elapsedFromT0}ms)`);
        break;
      case 'T5':
        this.currentTimeline.t5 = now;
        console.info(`[AUTH-DIAGNOSTIC id="r0t3k7"] T5: Firestore User Profile response received (+${elapsedFromT0}ms, ΔT4-T5=${this.currentTimeline.t4 ? Math.round(now - this.currentTimeline.t4) : 0}ms)`);
        break;
      case 'T6':
        this.currentTimeline.t6 = now;
        if (details?.role) this.currentTimeline.role = details.role;
        console.info(`[AUTH-DIAGNOSTIC id="r0t3k7"] T6: Role resolved: ${details?.role || this.currentTimeline.role || 'UNKNOWN'} (+${elapsedFromT0}ms)`);
        break;
      case 'T7':
        this.currentTimeline.t7 = now;
        console.info(`[AUTH-DIAGNOSTIC id="r0t3k7"] T7: Permission resolution completed (+${elapsedFromT0}ms)`);
        break;
      case 'T8':
        this.currentTimeline.t8 = now;
        console.info(`[AUTH-DIAGNOSTIC id="r0t3k7"] T8: Company/Profile context loaded (+${elapsedFromT0}ms)`);
        break;
      case 'T9':
        this.currentTimeline.t9 = now;
        console.info(`[AUTH-DIAGNOSTIC id="r0t3k7"] T9: Application initialization completed (+${elapsedFromT0}ms)`);
        break;
      case 'T10':
        this.currentTimeline.t10 = now;
        console.info(`[AUTH-DIAGNOSTIC id="r0t3k7"] T10: Redirect started to destination (+${elapsedFromT0}ms)`);
        break;
      case 'T11':
        this.currentTimeline.t11 = now;
        this.currentTimeline.status = 'COMPLETED';
        console.info(`[AUTH-DIAGNOSTIC id="r0t3k7"] T11: Destination page loaded (+${elapsedFromT0}ms total)`);
        this.logSummary();
        break;
    }

    if (typeof window !== 'undefined') {
      (window as any).__AUTH_DIAGNOSTIC_TIMELINE__ = this.currentTimeline;
      window.dispatchEvent(new CustomEvent('theunbound_auth_diagnostic', { detail: { stage, timeline: this.currentTimeline } }));
    }
  }

  public recordFailure(stage: string, error: any): void {
    const now = performance.now();
    const t0 = this.currentTimeline.t0 || now;
    const elapsed = Math.round(now - t0);
    const msg = error?.message || String(error);

    this.currentTimeline.errorStage = stage;
    this.currentTimeline.errorMessage = msg;
    this.currentTimeline.status = msg.toLowerCase().includes('timeout') ? 'TIMED_OUT' : 'FAILED';

    console.warn(`[AUTH-DIAGNOSTIC id="r0t3k7"] FAILED at stage ${stage} (+${elapsed}ms): ${msg}`);
    this.logSummary();

    if (typeof window !== 'undefined') {
      (window as any).__AUTH_DIAGNOSTIC_TIMELINE__ = this.currentTimeline;
      window.dispatchEvent(new CustomEvent('theunbound_auth_diagnostic_error', { detail: { stage, error: msg, timeline: this.currentTimeline } }));
    }
  }

  public getReport(): {
    timeline: AuthDiagnosticTimeline;
    deltas: Record<string, number>;
    summary: string;
  } {
    const t = this.currentTimeline;
    const deltas: Record<string, number> = {};

    if (t.t0 && t.t1) deltas['T0->T1 (Submit to Auth Start)'] = Math.round(t.t1 - t.t0);
    if (t.t1 && t.t2) deltas['T1->T2 (Firebase Auth Duration)'] = Math.round(t.t2 - t.t1);
    if (t.t2 && t.t3) deltas['T2->T3 (UID Resolution)'] = Math.round(t.t3 - t.t2);
    if (t.t3 && t.t4) deltas['T3->T4 (Auth to Profile Start)'] = Math.round(t.t4 - t.t3);
    if (t.t4 && t.t5) deltas['T4->T5 (Firestore Profile Fetch)'] = Math.round(t.t5 - t.t4);
    if (t.t5 && t.t6) deltas['T5->T6 (Role Resolution)'] = Math.round(t.t6 - t.t5);
    if (t.t6 && t.t7) deltas['T6->T7 (Permission Resolution)'] = Math.round(t.t7 - t.t6);
    if (t.t7 && t.t8) deltas['T7->T8 (Context Load)'] = Math.round(t.t8 - t.t7);
    if (t.t8 && t.t9) deltas['T8->T9 (App Init)'] = Math.round(t.t9 - t.t8);
    if (t.t9 && t.t10) deltas['T9->T10 (Redirect Trigger)'] = Math.round(t.t10 - t.t9);
    if (t.t10 && t.t11) deltas['T10->T11 (Destination Mount)'] = Math.round(t.t11 - t.t10);
    if (t.t0 && t.t11) deltas['Total Duration'] = Math.round(t.t11 - t.t0);

    let summary = `Status: ${t.status}`;
    if (t.errorStage) {
      summary += ` | FAILED at ${t.errorStage}: ${t.errorMessage}`;
    } else if (t.status === 'COMPLETED') {
      summary += ` | Completed in ${deltas['Total Duration'] || 0}ms`;
    }

    return { timeline: t, deltas, summary };
  }

  private logSummary(): void {
    const report = this.getReport();
    console.info(`[AUTH-DIAGNOSTIC id="r0t3k7"] SUMMARY:`, report.summary, report.deltas);
  }
}

export const authDiagnostic = AuthDiagnosticService.getInstance();
