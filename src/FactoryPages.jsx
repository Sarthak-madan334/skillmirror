import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, Plus, RefreshCw } from 'lucide-react';
import { skillMirrorApi } from './apiClient.js';

function PageHeading({ title, description, action }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function LoadState({ error, onRetry, children }) {
  if (error) return <div className="card-panel" role="alert"><AlertCircle size={18} /><p>{error}</p><button className="outline-button" onClick={onRetry}><RefreshCw size={15} /> Retry</button></div>;
  if (!children) return <div className="card-panel" role="status">Loading records...</div>;
  return children;
}

function useRequest(load, dependencies) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, error: '', loading: true }));
    load().then((data) => {
      if (active) setState({ data, error: '', loading: false });
    }).catch((error) => {
      if (active) setState({ data: null, error: error.message || 'Could not load records.', loading: false });
    });
    return () => { active = false; };
  }, [...dependencies, version]);
  return { ...state, retry: () => setVersion((value) => value + 1) };
}

function Metric({ label, value, detail }) {
  return <div className="metric-card"><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>;
}

export function FactoryOwnerDashboard({ organization, onNavigate }) {
  const request = useRequest(() => skillMirrorApi.ownerOverview(organization.id), [organization.id]);
  const data = request.data;
  return <div className="factory-shell">
    <PageHeading title={organization.name} description="Factory training and competency overview."
      action={<button className="button button-primary" onClick={() => onNavigate('/assignments')}>Assign training</button>} />
    <LoadState error={request.error} onRetry={request.retry}>{request.loading ? null : <>
      <div className="metric-grid">
        <Metric label="Active workers" value={data.metrics.totalWorkers} detail="Current organization records" />
        <Metric label="Training in progress" value={data.metrics.trainingInProgress} detail="Assignments underway" />
        <Metric label="Verified competencies" value={data.metrics.verifiedCompetencies} detail="Approved records" />
        <Metric label="Pending assessments" value={data.metrics.pendingAssessments} detail="Submissions awaiting review" />
        <Metric label="Overdue training" value={data.metrics.overdueTraining} detail="Required assignments past due" />
      </div>
      <div className="factory-grid">
        <section className="card-panel"><h2>Recent recorded activity</h2>
          {data.recentActivity.length ? <ul className="activity-list">{data.recentActivity.map((event) => <li className="activity-item" key={event.id}>
            <span className="dot" /><div><strong>{event.action.replaceAll('_', ' ').toLowerCase()}</strong><small>{new Date(event.createdAt).toLocaleString()}</small></div>
          </li>)}</ul> : <p>No activity has been recorded yet.</p>}
        </section>
        <section className="card-panel"><h2>Needs attention</h2>
          {data.attentionRequired.length ? <ul className="attention-list">{data.attentionRequired.map((item) => <li key={item.id}>
            <button className="link-button" onClick={() => onNavigate('/reviews')}>{item.session.learner.name}: {item.step.title} · {item.session.project.title}</button>
          </li>)}</ul> : <p>No pending assessment reviews.</p>}
        </section>
      </div>
    </>}</LoadState>
  </div>;
}

export function WorkersPage({ organization, onNavigate }) {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', employeeId: '', department: '' });
  const [formError, setFormError] = useState('');
  const [invitation, setInvitation] = useState(null);
  const [copied, setCopied] = useState(false);
  const request = useRequest(() => skillMirrorApi.listWorkers(organization.id, { search, status: 'ACTIVE', page: 1, pageSize: 25 }), [organization.id, search]);

  const addWorker = async (event) => {
    event.preventDefault();
    setFormError('');
    try {
      const result = await skillMirrorApi.addWorker(organization.id, form);
      setInvitation(result.invitation);
      setForm({ fullName: '', email: '', employeeId: '', department: '' });
      request.retry();
    } catch (error) {
      setFormError(error.message || 'Could not add this worker.');
    }
  };

  return <div>
    <PageHeading title="Workers" description={`${organization.name} · ${request.data?.total ?? '...'} active workers`}
      action={<button className="button button-primary" onClick={() => setFormOpen((open) => !open)}><Plus size={16} /> Add worker</button>} />
    {invitation && <div className="notice notice-success" role="status"><div><strong>Invitation created. It has not been emailed.</strong><p>Expires {new Date(invitation.expiresAt).toLocaleString()}</p><code>{invitation.token}</code></div>
      <button className="outline-button" onClick={async () => { await navigator.clipboard.writeText(invitation.token); setCopied(true); }}><Copy size={15} /> {copied ? 'Copied' : 'Copy'}</button>
      <button aria-label="Dismiss invitation" onClick={() => { setInvitation(null); setCopied(false); }}>Dismiss</button>
    </div>}
    {formOpen && <form className="card-panel form-stack" onSubmit={addWorker}>
      <h2>Add a worker</h2>
      <label>Name<input required maxLength="120" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
      <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label>Employee ID<input required value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} /></label>
      <label>Department<input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
      {formError && <p role="alert">{formError}</p>}
      <button className="button button-primary" type="submit">Create invitation</button>
    </form>}
    <label className="worker-search">Search workers<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or employee ID" /></label>
    <LoadState error={request.error} onRetry={request.retry}>{request.loading ? null : <div className="card-panel table-panel">
      {request.data.items.length ? <div className="table-scroll"><table className="worker-table"><thead><tr><th>Worker</th><th>Employee ID</th><th>Department</th><th>Assigned training</th><th>Verified competencies</th></tr></thead>
        <tbody>{request.data.items.map((worker) => <tr key={worker.id}>
          <td><a href={`#/workers/${worker.id}`}>{worker.fullName}</a></td><td>{worker.employeeId}</td><td>{worker.department || 'Not specified'}</td>
          <td>{worker.assignments.length}</td><td>{worker.competencies.filter((item) => item.status === 'VERIFIED').length}</td>
        </tr>)}</tbody></table></div> : <p>No workers found. Add a worker to start assigning training.</p>}
    </div>}</LoadState>
  </div>;
}

export function WorkerDetailPage({ organization, workerId }) {
  const request = useRequest(() => skillMirrorApi.getWorker(organization.id, workerId), [organization.id, workerId]);
  const worker = request.data?.worker;
  const [approvalError, setApprovalError] = useState('');
  const [approvalNotice, setApprovalNotice] = useState('');
  const approve = async (record) => {
    const feedback = window.prompt('Optional competency review feedback:', '');
    if (feedback === null || !window.confirm(`Approve ${record.competency.name} for ${worker.fullName}?`)) return;
    setApprovalError('');
    setApprovalNotice('');
    try {
      await skillMirrorApi.approveCompetency(organization.id, record.competencyId, { workerProfileId: worker.id, feedback });
      setApprovalNotice(`${record.competency.name} was approved.`);
      request.retry();
    } catch (cause) { setApprovalError(cause.message || 'Competency approval was not accepted.'); }
  };
  return <div><PageHeading title={worker?.fullName || 'Worker profile'} description={worker ? `${worker.employeeId} · ${worker.department || 'Department not specified'}` : 'Worker training and competency record.'} />
    <LoadState error={request.error} onRetry={request.retry}>{request.loading ? null : <>
      {approvalError && <p role="alert">{approvalError}</p>}{approvalNotice && <p role="status">{approvalNotice}</p>}
      <section className="card-panel"><h2>Training record</h2>{worker.assignments.length ? worker.assignments.map((assignment) => <article key={assignment.id}>
        <h3>{assignment.training.title}</h3><p>Status: {assignment.status.replaceAll('_', ' ').toLowerCase()} · Assigned {new Date(assignment.assignedAt).toLocaleDateString()}</p>
        {assignment.dueAt && <p>Due {new Date(assignment.dueAt).toLocaleDateString()}</p>}
      </article>) : <p>No training assignments.</p>}</section>
      <section className="card-panel"><h2>Competencies</h2>{worker.competencies.length ? worker.competencies.map((record) => <article key={record.id}>
        <h3>{record.competency.name}</h3><p>Status: {record.status.replaceAll('_', ' ').toLowerCase()}</p>
        {record.approvedBy && <p>Reviewed by {record.approvedBy.name}</p>}
        {record.verifiedAt && <p>Verified {new Date(record.verifiedAt).toLocaleDateString()}</p>}
        {record.reassessAt && <p>Reassessment due {new Date(record.reassessAt).toLocaleDateString()}</p>}
        {record.feedback && <p>{record.feedback}</p>}
        {record.status !== 'VERIFIED' && worker.assignments.some((assignment) => assignment.trainingId === record.competency.trainingId && ['PASSED', 'APPROVED'].includes(assignment.status)) && <button className="outline-button" onClick={() => approve(record)}>Approve competency</button>}
      </article>) : <p>No competency records.</p>}</section>
    </>}</LoadState>
  </div>;
}

export function FactoryReportsPage({ organization }) {
  const request = useRequest(() => skillMirrorApi.ownerReports(organization.id), [organization.id]);
  const [exportError, setExportError] = useState('');
  const exportCsv = async () => {
    setExportError('');
    try {
      const response = await fetch(skillMirrorApi.ownerReportExportUrl(organization.id), { credentials: 'include' });
      if (!response.ok) throw new Error('The report export could not be downloaded.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'skillmirror-report.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) { setExportError(error.message); }
  };
  const summary = request.data?.summary;
  return <div><PageHeading title="Reports" description={`${organization.name} · persisted assignment and competency records`}
    action={<button className="button button-primary" onClick={exportCsv}>Export CSV</button>} />
    <LoadState error={request.error} onRetry={request.retry}>{request.loading ? null : <>
      <div className="metric-grid"><Metric label="Assignments completed" value={`${summary.completed} of ${summary.assigned}`} detail={`${summary.completionPercentage}% of recorded assignments`} />
        <Metric label="Overdue assignments" value={summary.overdue} detail="Past due and not complete" />
        <Metric label="Verified competencies" value={summary.verifiedCompetencies} detail="Approved records" />
        <Metric label="Pending assessments" value={summary.pendingAssessments} detail="Awaiting owner review" />
      </div>
      {exportError && <p role="alert">{exportError}</p>}
      <section className="card-panel"><h2>Training coverage</h2>{request.data.byTraining.length ? request.data.byTraining.map((row) => <p key={row.title}>{row.title}: {row.completed} of {row.assigned} completed · {row.overdue} overdue</p>) : <p>No assignments have been recorded.</p>}</section>
    </>}</LoadState>
  </div>;
}

export function WorkerPortal() {
  const request = useRequest(() => skillMirrorApi.workerAssignments(), []);
  const assignments = request.data?.assignments || request.data?.items || [];
  const [session, setSession] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [evidence, setEvidence] = useState(null);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const openAssignment = async (assignment) => {
    setBusy(true);
    setActionError('');
    try {
      const started = await skillMirrorApi.startAssignedSession(assignment.id);
      const fullSession = await skillMirrorApi.getSession(started.id);
      setSession(fullSession);
      setStepIndex(fullSession.currentPosition || 0);
      setEvidence(null);
    } catch (cause) { setActionError(cause.message || 'Could not open this training.'); }
    finally { setBusy(false); }
  };
  const selectStep = async (index) => {
    if (!session) return;
    setStepIndex(index);
    try {
      const updated = await skillMirrorApi.updateProgress(session.id, { currentPosition: index });
      setSession((current) => ({ ...current, ...updated }));
    } catch (cause) { setActionError(cause.message || 'Could not save your place.'); }
  };
  const submitEvidence = async (withoutEvidence = false) => {
    if (!session) return;
    const step = session.project.steps[stepIndex];
    setBusy(true);
    setActionError('');
    try {
      let evidenceIds = [];
      if (!withoutEvidence && evidence) {
        const asset = await skillMirrorApi.uploadEvidence(session.id, step.id, evidence);
        evidenceIds = [asset.id];
      }
      await skillMirrorApi.submitAttempt(session.id, step.id, evidenceIds);
      setEvidence(null);
      setSession(await skillMirrorApi.getSession(session.id));
    } catch (cause) { setActionError(cause.message || 'Could not submit this attempt.'); }
    finally { setBusy(false); }
  };
  const refreshSession = async () => {
    if (session) setSession(await skillMirrorApi.getSession(session.id));
  };
  const complete = async () => {
    if (!session) return;
    setBusy(true);
    setActionError('');
    try {
      await skillMirrorApi.completeSession(session.id);
      setSession(null);
      request.retry();
    } catch (cause) { setActionError(cause.message || 'Every step needs an owner-reviewed pass before completion.'); }
    finally { setBusy(false); }
  };

  if (session) {
    const step = session.project.steps[stepIndex];
    const attempts = session.attempts.filter((attempt) => attempt.stepId === step?.id);
    const latest = attempts.at(-1);
    return <div><PageHeading title={session.project.title} description={`Step ${stepIndex + 1} of ${session.project.steps.length} · ${session.status.replaceAll('_', ' ').toLowerCase()}`}
      action={<button className="outline-button" onClick={() => setSession(null)}>Back to my training</button>} />
      {actionError && <p role="alert">{actionError}</p>}
      {step && <section className="card-panel worker-session"><div className="worker-step-nav">{session.project.steps.map((item, index) => <button key={item.id} className={index === stepIndex ? 'active' : ''} onClick={() => selectStep(index)}>{index + 1}. {item.title}</button>)}</div>
        <h2>{step.title}</h2><p>{step.instructions}</p>{step.safety && <p><strong>Safety:</strong> {step.safety}</p>}
        {step.expected && <p><strong>Expected result:</strong> {step.expected}</p>}
        {step.verification && <p><strong>Verification criteria:</strong> {step.verification}</p>}
        {latest && <div className="notice" role="status">Latest attempt: {latest.verificationStatus.replaceAll('_', ' ').toLowerCase()}. {latest.feedback}</div>}
        {latest?.evidence?.map((asset) => <p key={asset.id}><a href={skillMirrorApi.getMediaUrl(asset.id)} target="_blank" rel="noreferrer">Open submitted evidence</a></p>)}
        <label className="evidence-picker">Attach photo or video evidence<input type="file" accept="image/*,video/*" capture="environment" onChange={(event) => setEvidence(event.target.files?.[0] || null)} /></label>
        {evidence && <p>{evidence.name}</p>}
        <div className="factory-actions"><button className="button button-primary" disabled={busy || !evidence} onClick={() => submitEvidence()}>Submit evidence for review</button><button className="outline-button" disabled={busy} onClick={() => submitEvidence(true)}>Unable to provide evidence</button><button className="outline-button" disabled={busy} onClick={refreshSession}>Refresh review status</button></div>
        <div className="factory-actions"><button className="outline-button" disabled={stepIndex === 0} onClick={() => selectStep(stepIndex - 1)}>Previous step</button><button className="outline-button" disabled={stepIndex >= session.project.steps.length - 1} onClick={() => selectStep(stepIndex + 1)}>Next step</button><button className="button button-primary" disabled={busy} onClick={complete}>Complete reviewed training</button></div>
      </section>}
    </div>;
  }

  return <div><PageHeading title="My training" description="Training assigned to your worker profile." />
    {actionError && <p role="alert">{actionError}</p>}
    <LoadState error={request.error} onRetry={request.retry}>{request.loading ? null : <div className="worker-portal-grid">
      {assignments.length ? assignments.map((assignment) => <article className="card-panel assignment-card" key={assignment.id}>
        <h2>{assignment.training?.title || assignment.title}</h2><p>Status: {(assignment.effectiveStatus || assignment.status).replaceAll('_', ' ').toLowerCase()}</p>
        {assignment.dueAt && <p>Due {new Date(assignment.dueAt).toLocaleDateString()}</p>}
        <button className="button button-primary" disabled={busy || ['APPROVED', 'PASSED'].includes(assignment.status)} onClick={() => openAssignment(assignment)}>{busy ? 'Opening...' : ['IN_PROGRESS', 'SUBMITTED', 'NEEDS_IMPROVEMENT'].includes(assignment.status) ? 'Continue training' : 'Start training'}</button>
      </article>) : <div className="card-panel"><Check size={18} /><p>No training is currently assigned to you.</p></div>}
    </div>}</LoadState>
  </div>;
}

export function WorkerProgressPage() {
  const request = useRequest(() => skillMirrorApi.workerProgress(), []);
  return <div><PageHeading title="My progress" description="Your own assignment and approved competency records." />
    <LoadState error={request.error} onRetry={request.retry}>{request.loading ? null : <>
      <section className="card-panel"><h2>Competencies</h2>{request.data.competencies.length ? request.data.competencies.map((record) => <article key={record.id}>
        <h3>{record.competency.name}</h3><p>Status: {record.status.replaceAll('_', ' ').toLowerCase()}</p>
        {record.approvedBy && <p>Reviewed by {record.approvedBy.name}</p>}{record.verifiedAt && <p>Verified {new Date(record.verifiedAt).toLocaleDateString()}</p>}{record.reassessAt && <p>Reassessment due {new Date(record.reassessAt).toLocaleDateString()}</p>}
      </article>) : <p>No competency approvals are recorded yet.</p>}</section>
      <section className="card-panel"><h2>Training history</h2>{request.data.assignments.length ? request.data.assignments.map((assignment) => <p key={assignment.id}>{assignment.training.title} · {assignment.status.replaceAll('_', ' ').toLowerCase()}</p>) : <p>No training assignments are recorded yet.</p>}</section>
    </>}</LoadState>
  </div>;
}

export function OwnerAssignmentsPage({ organization }) {
  const resources = useRequest(async () => {
    const [workers, trainings, current] = await Promise.all([
      skillMirrorApi.listWorkers(organization.id, { status: 'ACTIVE', page: 1, pageSize: 50 }),
      skillMirrorApi.listOrganizationTrainings(organization.id),
      skillMirrorApi.listAssignments(organization.id),
    ]);
    return { workers: workers.items, trainings: trainings.items.filter((item) => item.status === 'published'), assignments: current.assignments };
  }, [organization.id]);
  const [trainingId, setTrainingId] = useState('');
  const [workerIds, setWorkerIds] = useState([]);
  const [dueAt, setDueAt] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedTraining = resources.data?.trainings.find((item) => item.id === trainingId);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const result = await skillMirrorApi.assignTraining(organization.id, {
        trainingId,
        workerProfileIds: workerIds,
        competencyIds: [],
        dueAt: dueAt ? new Date(`${dueAt}T23:59:59`).toISOString() : null,
        requiresOwnerApproval: requiresApproval,
      });
      setSuccess(`Created ${result.assignments.length} assignment${result.assignments.length === 1 ? '' : 's'}.`);
      setWorkerIds([]);
      resources.retry();
    } catch (cause) {
      setError(cause.message || 'Could not create these assignments.');
    } finally { setSaving(false); }
  };

  return <div><PageHeading title="Training assignments" description={`${organization.name} · assign published procedures to active workers`} />
    <LoadState error={resources.error} onRetry={resources.retry}>{resources.loading ? null : <>
      <form className="card-panel form-stack" onSubmit={submit}>
        <h2>New assignment</h2>
        <label>Published training<select required value={trainingId} onChange={(event) => setTrainingId(event.target.value)}><option value="">Choose a procedure</option>{resources.data.trainings.map((training) => <option key={training.id} value={training.id}>{training.title}</option>)}</select></label>
        {!resources.data.trainings.length && <p>No published factory training is available. Publish a procedure before assigning it.</p>}
        {selectedTraining && <div className="assignment-preview"><strong>{selectedTraining.title}</strong><p>{selectedTraining.description}</p><span>{selectedTraining.steps.length} required steps</span></div>}
        <fieldset><legend>Workers ({workerIds.length} selected)</legend>
          {resources.data.workers.map((worker) => <label className="worker-choice" key={worker.id}><input type="checkbox" checked={workerIds.includes(worker.id)} onChange={(event) => setWorkerIds((current) => event.target.checked ? [...current, worker.id] : current.filter((id) => id !== worker.id))} />{worker.fullName} · {worker.employeeId}</label>)}
          {!resources.data.workers.length && <p>No active workers are available.</p>}
        </fieldset>
        <label>Due date (optional)<input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
        <label className="worker-choice"><input type="checkbox" checked={requiresApproval} onChange={(event) => setRequiresApproval(event.target.checked)} />Require owner approval</label>
        <p>Confirmation: {selectedTraining?.title || 'No training selected'} · {workerIds.length} worker{workerIds.length === 1 ? '' : 's'}{dueAt ? ` · due ${dueAt}` : ''}</p>
        {error && <p role="alert">{error}</p>}{success && <p role="status">{success}</p>}
        <button className="button button-primary" type="submit" disabled={saving || !trainingId || !workerIds.length}>{saving ? 'Assigning...' : 'Assign training'}</button>
      </form>
      <section className="card-panel"><h2>Current assignments</h2>{resources.data.assignments.length ? <div className="table-scroll"><table className="worker-table"><thead><tr><th>Worker</th><th>Training</th><th>Status</th><th>Due</th></tr></thead><tbody>
        {resources.data.assignments.map((assignment) => <tr key={assignment.id}><td>{assignment.worker.fullName}</td><td>{assignment.training.title}</td><td>{(assignment.effectiveStatus || assignment.status).replaceAll('_', ' ').toLowerCase()}</td><td>{assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString() : 'No deadline'}</td></tr>)}
      </tbody></table></div> : <p>No training has been assigned yet.</p>}</section>
    </>}</LoadState>
  </div>;
}

export function ReviewsPage({ organization }) {
  const queue = useRequest(() => skillMirrorApi.ownerOverview(organization.id), [organization.id]);
  const [selected, setSelected] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selected) { setReviewData(null); return undefined; }
    let active = true;
    Promise.all([
      skillMirrorApi.listAttempts(selected.session.id),
      skillMirrorApi.getTraining(selected.session.projectId),
    ]).then(([attemptResult, training]) => {
      if (active) setReviewData({ attempts: attemptResult.attempts, training });
    }).catch((cause) => { if (active) setError(cause.message || 'Could not load review evidence.'); });
    return () => { active = false; };
  }, [selected]);

  const review = async (status) => {
    if (!selected || !feedback.trim()) { setError('Add feedback before recording a review.'); return; }
    if (!window.confirm(`Record this assessment as ${status.replaceAll('_', ' ').toLowerCase()}?`)) return;
    setSaving(true);
    setError('');
    try {
      await skillMirrorApi.reviewAttempt(selected.session.id, selected.id, { status, feedback: feedback.trim() });
      setSelected(null);
      setFeedback('');
      queue.retry();
    } catch (cause) { setError(cause.message || 'Could not save this review.'); }
    finally { setSaving(false); }
  };

  const pending = queue.data?.attentionRequired || [];
  const training = reviewData?.training;
  const step = training?.steps.find((item) => item.id === selected?.stepId);
  const attempts = reviewData?.attempts.filter((item) => item.stepId === selected?.stepId) || [];
  return <div><PageHeading title="Reviews" description={`${organization.name} · evidence awaiting human assessment`} />
    <LoadState error={queue.error} onRetry={queue.retry}>{queue.loading ? null : <>
      {error && <p role="alert">{error}</p>}
      <section className="card-panel"><h2>Pending assessments</h2>{pending.length ? <div className="table-scroll"><table className="worker-table"><thead><tr><th>Worker</th><th>Training</th><th>Step</th><th>Submitted</th><th>Attempts</th><th /></tr></thead><tbody>
        {pending.map((attempt) => <tr key={attempt.id}><td>{attempt.session.learner.name}</td><td>{attempt.session.project.title}</td><td>{attempt.step.title}</td><td>{new Date(attempt.submittedAt).toLocaleString()}</td><td>{attempt.attemptNumber}</td><td><button className="outline-button" onClick={() => { setSelected(attempt); setError(''); }}>Review</button></td></tr>)}
      </tbody></table></div> : <p>No reviews are waiting. New evidence submissions will appear here.</p>}</section>
      {selected && <section className="card-panel"><h2>{selected.session.learner.name} · {selected.session.project.title}</h2>
        <h3>{step?.title || selected.step.title}</h3><p>Submitted {new Date(selected.submittedAt).toLocaleString()} · attempt {selected.attemptNumber}</p>
        {step && <><p><strong>Expected:</strong> {step.expected || 'No expected result specified.'}</p><p><strong>Verification criteria:</strong> {step.verification || 'No criteria specified.'}</p></>}
        <h3>Evidence</h3>{attempts.find((item) => item.id === selected.id)?.evidence?.length ? attempts.find((item) => item.id === selected.id).evidence.map((asset) => <p key={asset.id}>{asset.mimeType} · {Math.ceil(asset.sizeBytes / 1024)} KB · <a href={skillMirrorApi.getMediaUrl(asset.id)} target="_blank" rel="noreferrer">Open protected evidence</a></p>) : <p>No evidence file is attached. Use “Unable to verify” if the submission cannot be evaluated.</p>}
        <label>Reviewer feedback<textarea required minLength="1" maxLength="2000" value={feedback} onChange={(event) => setFeedback(event.target.value)} /></label>
        <div className="factory-actions"><button className="button button-primary" disabled={saving} onClick={() => review('PASSED')}>Pass</button><button className="outline-button" disabled={saving} onClick={() => review('NEEDS_IMPROVEMENT')}>Needs improvement</button><button className="outline-button" disabled={saving} onClick={() => review('UNABLE_TO_VERIFY')}>Unable to verify</button><button className="text-button" onClick={() => setSelected(null)}>Close</button></div>
      </section>}
    </>}</LoadState>
  </div>;
}

export function TrainingManagementPage({ organization, onNavigate }) {
  const request = useRequest(() => skillMirrorApi.listOrganizationTrainings(organization.id), [organization.id]);
  const [actionError, setActionError] = useState('');
  const [duplicating, setDuplicating] = useState('');
  const trainings = request.data?.items || [];
  const duplicate = async (training) => {
    setActionError('');
    setDuplicating(training.id);
    try {
      const copy = await skillMirrorApi.createOrganizationTraining(organization.id, {
        title: `${training.title} copy`,
        description: training.description,
        category: training.category,
        level: training.level,
        duration: training.duration,
        objectives: training.objectives,
        materials: training.materials,
        status: 'draft',
        demonstration: training.demonstration,
        steps: training.steps.map(({ id: _id, position: _position, ...step }) => step),
      });
      onNavigate(`/training/${copy.id}`);
    } catch (cause) { setActionError(cause.message || 'Could not duplicate this procedure.'); }
    finally { setDuplicating(''); }
  };
  return <div><PageHeading title="Training" description={`${organization.name} · factory-owned procedures and drafts`}
    action={<button className="button button-primary" onClick={() => onNavigate('/training/new')}><Plus size={16} /> Create procedure</button>} />
    <LoadState error={request.error} onRetry={request.retry}>{request.loading ? null : <>
      {actionError && <p role="alert">{actionError}</p>}
      <div className="factory-actions"><button className="outline-button" onClick={() => onNavigate('/assignments')}>Assign training</button></div>
      {trainings.length ? <div className="card-panel table-panel"><div className="table-scroll"><table className="worker-table"><thead><tr><th>Procedure</th><th>Category</th><th>Steps</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
        {trainings.map((training) => <tr key={training.id}><td>{training.title}</td><td>{training.category}</td><td>{training.steps.length}</td><td>{training.status}</td><td>{new Date(training.updatedAt).toLocaleDateString()}</td><td><div className="factory-actions"><button className="outline-button" onClick={() => onNavigate(`/training/${training.id}`)}>{training.status === 'published' ? 'Edit procedure' : 'Edit draft'}</button><button className="outline-button" disabled={duplicating === training.id} onClick={() => duplicate(training)}>{duplicating === training.id ? 'Duplicating...' : 'Duplicate as draft'}</button></div></td></tr>)}
      </tbody></table></div></div> : <div className="card-panel"><h2>No factory procedures yet</h2><p>Create a draft, review its steps, and publish it before assigning it to workers.</p><button className="button button-primary" onClick={() => onNavigate('/training/new')}>Create procedure</button></div>}
    </>}</LoadState>
  </div>;
}