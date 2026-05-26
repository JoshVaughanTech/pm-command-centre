'use client';

type OnboardingProps = {
  userName: string;
  hasProjects: boolean;
  onAddProject: () => void;
  onImport: () => void;
  onGenerateMoves: () => void;
  onDismiss: () => void;
};

export function Onboarding({ userName, hasProjects, onAddProject, onImport, onGenerateMoves, onDismiss }: OnboardingProps) {
  return (
    <div className="onboard">
      <div className="onboard-brand">
        <span className="console-brand-mark">SNTRI</span>
      </div>
      <h1 className="onboard-title">Welcome{userName ? `, ${userName}` : ''}</h1>
      <p className="onboard-sub">
        SNTRI is your project command centre. Get started by adding your first project — manually or by importing from a tool you already use.
      </p>
      <div className="onboard-steps">
        <button
          className={`onboard-step ${hasProjects ? 'onboard-step--done' : ''}`}
          onClick={onAddProject}
        >
          <span className="onboard-step-num">{hasProjects ? '✓' : '1'}</span>
          <div className="onboard-step-text">
            <div className="onboard-step-title">Create your first project</div>
            <div className="onboard-step-desc">Add a project manually with code, client, and stage</div>
          </div>
        </button>
        <button className="onboard-step" onClick={onImport}>
          <span className="onboard-step-num">2</span>
          <div className="onboard-step-text">
            <div className="onboard-step-title">Import from a PM tool</div>
            <div className="onboard-step-desc">Connect Smartsheet, Asana, Monday.com, or upload a CSV</div>
          </div>
        </button>
        {hasProjects && (
          <button className="onboard-step" onClick={onGenerateMoves}>
            <span className="onboard-step-num">3</span>
            <div className="onboard-step-text">
              <div className="onboard-step-title">Generate AI moves</div>
              <div className="onboard-step-desc">Get recommended actions for each project based on health and risks</div>
            </div>
          </button>
        )}
      </div>
      {hasProjects && (
        <button className="onboard-skip" onClick={onDismiss}>
          Skip — go to dashboard
        </button>
      )}
    </div>
  );
}
