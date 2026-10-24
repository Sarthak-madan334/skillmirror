import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CircleHelp, FileImage, LoaderCircle, LogOut, Plus, RefreshCw, Server, ShieldCheck, Upload } from 'lucide-react';
import { ApiClientError, API_BASE_URL, skillMirrorApi } from './apiClient.js';

function ApiButton({ children, icon: Icon, variant = 'primary', ...props }) {
  return <button className={`button button-${variant}`} {...props}>{Icon && <Icon size={16} aria-hidden="true" />}<span>{children}</span></button>;
}

function ErrorNotice({ error }) {
  if (!error) return null;
  return <div className="api-alert" role="alert"><AlertCircle size={17} /><span>{error}</span></div>;
}

export default function ApiWorkspace() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authFields, setAuthFields] = useState({ name: '', email: '', password: '' });
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [session, setSession] = useState(null);
  const [report, setReport] = useState(null);
  const [newTraining, setNewTraining] = useState({ title: '', description: '' });
  const [newStep, setNewStep] = useState({ title: '', instructions: '', expected: '', verification: '' });
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState('Reviewed by the instructor.');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 401) {
        setUser(null);
        setSession(null);
        setSelected(null);
      }
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    } finally {
      setBusy(false);
    }
  };

  const loadProject = async (id) => {
    const project = await skillMirrorApi.getTraining(id);
    setSelected(project);
    setSession(null);
    setReport(null);
  };

  const reloadProjects = async () => {
    const result = await skillMirrorApi.listTrainings({ page: 1, pageSize: 50 });
    setProjects(result.items);
  };

  const reloadSession = async (id = session?.id) => {
    if (!id) return;
    const result = await skillMirrorApi.getSession(id);
    setSession(result);
  };

  useEffect(() => {
    let cancelled = false;
    skillMirrorApi.me().then((result) => {
      if (!cancelled) setUser(result.user);
    }).catch((cause) => {
      if (!cancelled && !(cause instanceof ApiClientError && cause.status === 401)) {
        setError(cause instanceof Error ? cause.message : 'Could not check the API session.');
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user) return undefined;
    skillMirrorApi.listTrainings({ page: 1, pageSize: 50 }).then((result) => {
      if (!cancelled) setProjects(result.items);
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load training.');
    });
    return () => { cancelled = true; };
  }, [user]);

  const authenticate = (event) => {
    event.preventDefault();
    void run(async () => {
      if (authMode === 'register') {
        await skillMirrorApi.register(authFields);
        setAuthMode('login');
        setAuthFields((current) => ({ ...current, password: '' }));
        setNotice('If the details are eligible, the account is ready. Sign in to continue.');
        return;
      }
      const result = await skillMirrorApi.login({ email: authFields.email, password: authFields.password });
      setUser(result.user);
      setNotice('Signed in with a secure session cookie.');
    });
  };

  const createProject = (event) => {
    event.preventDefault();
    void run(async () => {
      const project = await skillMirrorApi.createTraining({
        ...newTraining,
        category: 'Maker skills',
        level: 'Beginner',
        duration: 15,
        objectives: '',
        materials: [],
        status: 'draft',
        steps: [],
      });
      setNewTraining({ title: '', description: '' });
      await reloadProjects();
      await loadProject(project.id);
      setNotice('Draft created in the connected backend.');
    });
  };

  const addStep = (event) => {
    event.preventDefault();
    if (!selected) return;
    void run(async () => {
      await skillMirrorApi.addStep(selected.id, newStep);
      setNewStep({ title: '', instructions: '', expected: '', verification: '' });
      await loadProject(selected.id);
      setNotice('Step saved to the backend.');
    });
  };

  const reorder = (step, offset) => {
    const position = selected.steps.findIndex((item) => item.id === step.id);
    const target = position + offset;
    if (target < 0 || target >= selected.steps.length) return;
    const steps = [...selected.steps];
    [steps[position], steps[target]] = [steps[target], steps[position]];
    void run(async () => {
      await skillMirrorApi.reorderSteps(selected.id, steps.map((item) => item.id));
      await loadProject(selected.id);
      setNotice('Step order saved.');
    });
  };

  const togglePublish = () => {
    if (!selected) return;
    const status = selected.status === 'published' ? 'draft' : 'published';
    void run(async () => {
      const project = await skillMirrorApi.updateTraining(selected.id, { status });
      setSelected(project);
      await reloadProjects();
      setNotice(status === 'published' ? 'Guide published for signed-in learners.' : 'Guide returned to draft.');
    });
  };

  const generateSample = () => {
    if (!selected || !/paper\s+bridge/i.test(`${selected.title} ${selected.description}`)) return;
    if (selected.steps.length && !window.confirm('Replace the current draft steps with the sample outline?')) return;
    void run(async () => {
      const result = await skillMirrorApi.generateSampleSteps(selected.id);
      const project = await skillMirrorApi.saveProcedure(selected.id, {
        title: selected.title,
        description: selected.description,
        category: selected.category,
        level: selected.level,
        duration: selected.duration,
        objectives: selected.objectives,
        materials: selected.materials,
        demonstration: selected.demonstration,
        status: 'draft',
        steps: result.steps,
      });
      setSelected(project);
      await reloadProjects();
      setNotice(`Added ${result.steps.length} sample-template steps. Provenance: ${result.provenance}; simulated: ${result.simulated}; instructor review required.`);
    });
  };

  const beginSession = () => {
    if (!selected) return;
    void run(async () => {
      const opened = await skillMirrorApi.createSession(selected.id);
      await reloadSession(opened.id);
      setNotice('Practice session started or resumed.');
    });
  };

  const goToPosition = (position) => {
    if (!session) return;
    void run(async () => {
      await skillMirrorApi.updateProgress(session.id, { currentPosition: position });
      await reloadSession();
    });
  };

  const submitAttempt = () => {
    if (!session || !selected) return;
    const step = selected.steps[session.currentPosition];
    if (!step) return;
    void run(async () => {
      let evidenceIds = [];
      if (evidenceFile) {
        const asset = await skillMirrorApi.uploadEvidence(session.id, step.id, evidenceFile);
        evidenceIds = [asset.id];
        setEvidenceFile(null);
      }
      const attempt = await skillMirrorApi.submitAttempt(session.id, step.id, evidenceIds);
      await reloadSession();
      setNotice(attempt.verificationStatus === 'NEEDS_REVIEW'
        ? 'Evidence submitted. Waiting for human review; no automated verification occurred.'
        : 'No evidence was submitted, so this attempt is marked unable to verify.');
    });
  };

  const reviewAttempt = (attemptId, status) => {
    if (!session) return;
    void run(async () => {
      await skillMirrorApi.reviewAttempt(session.id, attemptId, { status, feedback: reviewFeedback });
      await reloadSession();
      setNotice('Instructor review saved.');
    });
  };

  const loadReport = () => {
    if (!session) return;
    void run(async () => setReport(await skillMirrorApi.getReport(session.id)));
  };

  const completeSession = () => {
    if (!session) return;
    void run(async () => {
      const result = await skillMirrorApi.completeSession(session.id);
      setReport(result);
      await reloadSession();
      setNotice('Session completed from reviewed attempts.');
    });
  };

  if (!user) {
    return <section className="api-workspace">
      <header className="api-heading"><span className="api-heading-mark"><Server size={20} /></span><div><span className="eyebrow">LIVE BACKEND CONNECTION</span><h1>Connect to SkillMirror API</h1><p>Sign in to create server-backed guides and review stored learner attempts.</p></div></header>
      <div className="api-connection-line"><span className="connection-dot" /> API base URL <code>{API_BASE_URL}</code><button className="api-inline-button" onClick={() => void run(async () => { await skillMirrorApi.health(); setNotice('API is reachable.'); })}><RefreshCw size={14} /> Check connection</button></div>
      <ErrorNotice error={error} />
      {notice && <div className="api-success" role="status"><ShieldCheck size={16} />{notice}</div>}
      <form className="api-auth-form" onSubmit={authenticate}>
        <div className="api-auth-tabs"><button type="button" className={authMode === 'login' ? 'api-tab-active' : ''} onClick={() => { setAuthMode('login'); setError(''); }}>Sign in</button><button type="button" className={authMode === 'register' ? 'api-tab-active' : ''} onClick={() => { setAuthMode('register'); setError(''); }}>Create account</button></div>
        {authMode === 'register' && <label className="api-field">Name<input required maxLength={100} autoComplete="name" value={authFields.name} onChange={(event) => setAuthFields({ ...authFields, name: event.target.value })} /></label>}
        <label className="api-field">Email<input required type="email" autoComplete="email" value={authFields.email} onChange={(event) => setAuthFields({ ...authFields, email: event.target.value })} /></label>
        <label className="api-field">Password<input required type="password" minLength={authMode === 'register' ? 12 : 1} maxLength={128} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} value={authFields.password} onChange={(event) => setAuthFields({ ...authFields, password: event.target.value })} />{authMode === 'register' && <small>At least 12 characters, including upper-case, lower-case, and a number.</small>}</label>
        <ApiButton icon={busy ? LoaderCircle : ShieldCheck} disabled={busy}>{busy ? 'Connecting…' : authMode === 'register' ? 'Create account' : 'Sign in'}</ApiButton>
        <p className="api-auth-note"><ShieldCheck size={15} /> Authentication uses an HttpOnly cookie. Passwords are never stored in browser localStorage.</p>
      </form>
    </section>;
  }

  const currentStep = session && selected?.steps[session.currentPosition];
  const attempts = session?.attempts || [];
  const pendingAttempts = attempts.filter((attempt) => attempt.verificationStatus === 'NEEDS_REVIEW');

  return <section className="api-workspace">
    <header className="api-heading api-heading-connected"><span className="api-heading-mark"><Server size={20} /></span><div><span className="eyebrow">CONNECTED API WORKSPACE</span><h1>Training, persisted on the server.</h1><p>Manage backend records independently from the browser-only prototype.</p></div><div className="api-user-chip"><span>{user.name.slice(0, 1).toUpperCase()}</span><strong>{user.name}</strong><button className="api-inline-button" onClick={() => void run(async () => { await skillMirrorApi.logout(); setUser(null); setProjects([]); setSelected(null); setSession(null); setReport(null); })}><LogOut size={14} /> Sign out</button></div></header>
    <div className="api-connection-line"><span className="connection-dot" /> Connected to <code>{API_BASE_URL}</code><span className="api-cookie-label"><ShieldCheck size={14} /> HttpOnly session</span></div>
    <ErrorNotice error={error} />
    {notice && <div className="api-success" role="status"><Check size={16} />{notice}</div>}
    <div className="api-columns">
      <aside className="api-project-panel"><div className="api-panel-heading"><div><span className="eyebrow">YOUR ACCOUNT</span><h2>Training guides</h2></div><button className="icon-button" aria-label="Refresh training list" onClick={() => void run(reloadProjects)}><RefreshCw size={16} /></button></div>
        <form className="api-create-form" onSubmit={createProject}><label className="api-field">Title<input required maxLength={120} value={newTraining.title} onChange={(event) => setNewTraining({ ...newTraining, title: event.target.value })} placeholder="A skill to teach" /></label><label className="api-field">Description<textarea required maxLength={1000} rows={2} value={newTraining.description} onChange={(event) => setNewTraining({ ...newTraining, description: event.target.value })} placeholder="What should a learner practise?" /></label><ApiButton icon={Plus} disabled={busy}>Create server draft</ApiButton></form>
        <div className="api-project-list">{projects.length ? projects.map((project) => <button key={project.id} className={`api-project-row ${selected?.id === project.id ? 'api-project-active' : ''}`} onClick={() => void run(() => loadProject(project.id))}><span><strong>{project.title}</strong><small>{project.steps.length} steps · {project.status}</small></span><ArrowRight size={15} /></button>) : <p className="api-empty">No server-side guides yet.</p>}</div>
      </aside>

      <main className="api-main-panel">
        {!selected ? <div className="api-empty-main"><Server size={26} /><h2>Start with a backend draft.</h2><p>Create a guide on the left. It will be stored in PostgreSQL after the database is configured.</p></div> : <>
          <div className="api-selected-heading"><div><span className="eyebrow">{selected.status === 'published' ? 'PUBLISHED GUIDE' : 'SERVER DRAFT'}</span><h2>{selected.title}</h2><p>{selected.description}</p></div><div className="api-selected-actions"><ApiButton variant="secondary" onClick={togglePublish} disabled={busy || selected.steps.length === 0}>{selected.status === 'published' ? 'Return to draft' : 'Publish guide'}</ApiButton>{selected.status === 'published' && <ApiButton icon={ArrowRight} onClick={beginSession} disabled={busy}>Start / resume</ApiButton>}</div></div>
          <div className="api-steps-list">{selected.steps.map((step, index) => <article className="api-step-row" key={step.id}><span className="api-step-number">{String(index + 1).padStart(2, '0')}</span><div><strong>{step.title}</strong><p>{step.instructions}</p>{step.expected && <small>Expected: {step.expected}</small>}</div><div className="api-step-order"><button className="icon-button" aria-label={`Move ${step.title} up`} disabled={index === 0 || busy || Boolean(session)} onClick={() => reorder(step, -1)}><ArrowUp size={15} /></button><button className="icon-button" aria-label={`Move ${step.title} down`} disabled={index === selected.steps.length - 1 || busy || Boolean(session)} onClick={() => reorder(step, 1)}><ArrowDown size={15} /></button></div></article>)}</div>
          {selected.status !== 'published' && !session && <form className="api-step-form" onSubmit={addStep}><div className="api-panel-heading"><h3><Plus size={16} /> Add a practice step</h3><ApiButton type="button" icon={Server} variant="secondary" onClick={generateSample} disabled={busy || !/paper\s+bridge/i.test(`${selected.title} ${selected.description}`)}>Use sample template</ApiButton></div><p className="api-clarifier">The paper-bridge outline is a local template, not AI generation. Review every step before publishing.</p><div className="api-step-form-grid"><label className="api-field">Step title<input required maxLength={120} value={newStep.title} onChange={(event) => setNewStep({ ...newStep, title: event.target.value })} /></label><label className="api-field">Instructions<textarea required maxLength={2000} rows={2} value={newStep.instructions} onChange={(event) => setNewStep({ ...newStep, instructions: event.target.value })} /></label><label className="api-field">Expected result<input maxLength={1000} value={newStep.expected} onChange={(event) => setNewStep({ ...newStep, expected: event.target.value })} /></label><label className="api-field">Self-check<input maxLength={1000} value={newStep.verification} onChange={(event) => setNewStep({ ...newStep, verification: event.target.value })} /></label></div><ApiButton icon={Plus} disabled={busy}>Save step</ApiButton></form>}
          {session && <section className="api-session-panel"><div className="api-session-heading"><div><span className="eyebrow">LEARNER SESSION</span><h3>{session.status === 'COMPLETED' ? 'Session complete' : `Step ${session.currentPosition + 1} of ${selected.steps.length}`}</h3></div><span className="api-state-chip">{session.status.toLowerCase().replace('_', ' ')}</span></div>
            {currentStep ? <><div className="api-current-step"><strong>{currentStep.title}</strong><p>{currentStep.instructions}</p>{currentStep.expected && <small>Look for: {currentStep.expected}</small>}</div><div className="api-learner-actions"><button className="icon-button bordered-icon" aria-label="Previous step" disabled={session.currentPosition === 0 || busy} onClick={() => goToPosition(session.currentPosition - 1)}><ArrowLeft size={16} /></button><label className="api-evidence-control"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)} /><FileImage size={16} /><span>{evidenceFile ? evidenceFile.name : 'Attach evidence'}</span><Upload size={14} /></label><ApiButton icon={Check} onClick={submitAttempt} disabled={busy}>Submit for review</ApiButton><button className="icon-button bordered-icon" aria-label="Next step" disabled={session.currentPosition >= selected.steps.length - 1 || busy} onClick={() => goToPosition(session.currentPosition + 1)}><ArrowRight size={16} /></button></div><p className="api-clarifier"><CircleHelp size={14} /> Evidence is stored privately. Submission requests human review; the backend does not run computer vision.</p></> : <p className="api-clarifier"><ShieldCheck size={15} /> Completion requires an instructor-reviewed pass for every step.</p>}
            {attempts.length > 0 && <div className="api-attempts"><div className="api-panel-heading"><div><span className="eyebrow">RECORDED ATTEMPTS</span><h3>{attempts.length} submitted</h3></div><button className="api-inline-button" onClick={loadReport}>Refresh report</button></div>{attempts.map((attempt) => <article className="api-attempt-row" key={attempt.id}><div><strong>{attempt.step.title} · attempt {attempt.attemptNumber}</strong><span>{attempt.verificationStatus.toLowerCase().replaceAll('_', ' ')} · {attempt.evidence.length} evidence files</span><p>{attempt.feedback}</p></div>{pendingAttempts.some((item) => item.id === attempt.id) && selected.ownerId === user.id && <div className="api-review-buttons"><button onClick={() => reviewAttempt(attempt.id, 'PASSED')} disabled={busy}>Pass</button><button onClick={() => reviewAttempt(attempt.id, 'NEEDS_IMPROVEMENT')} disabled={busy}>Needs work</button><button onClick={() => reviewAttempt(attempt.id, 'UNABLE_TO_VERIFY')} disabled={busy}>Unable</button></div>}</article>)}<div className="api-session-footer"><ApiButton variant="secondary" onClick={completeSession} disabled={busy || session.status === 'COMPLETED'}>Complete reviewed session</ApiButton><ApiButton variant="secondary" onClick={loadReport}>Get report</ApiButton></div></div>}
            {report && <div className="api-report"><span className="eyebrow">ASSESSMENT REPORT · {report.assessmentMethod}</span><strong>{report.passedSteps} of {report.totalSteps} steps reviewed as passed ({report.completionPercentage}%).</strong><p>{report.pendingSteps} awaiting review · {report.stepsNeedingImprovement} need improvement.</p>{report.recommendations.map((recommendation) => <small key={recommendation}>{recommendation}</small>)}</div>}
          </section>}
        </>}
      </main>
    </div>
  </section>;
}