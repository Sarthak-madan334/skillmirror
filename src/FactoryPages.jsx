import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, BookOpen, Plus, RefreshCw, Users } from 'lucide-react';
import { ApiClientError, skillMirrorApi } from './apiClient.js';

function useFactoryData() {
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [workerProfiles, setWorkerProfiles] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (action) => {
    setBusy(true); setError(''); setNotice('');
    try { return await action(); }
    catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 401) setUser(null);
      setError(cause instanceof Error ? cause.message : 'The request failed.');
      return null;
    } finally { setBusy(false); }
  }, []);
  const reloadOrganizations = useCallback(async () => {
    const data = await skillMirrorApi.listOrganizations();
    setOrganizations(data.organizations || []);
    setOrganization((current) => data.organizations.find((item) => item.id === current?.id) || data.organizations[0] || null);
  }, []);
  useEffect(() => {
    let active = true;
    skillMirrorApi.me().then(({ user: currentUser, memberships: currentMemberships, workerProfiles: profiles }) => {
      if (!active) return;
      setUser(currentUser);
      setMemberships(currentMemberships || []); setWorkerProfiles(profiles || []);
      if ((currentMemberships || []).some((item) => item.role === 'OWNER')) void reloadOrganizations().catch((e) => active && setError(e.message));
    }).catch((cause) => { if (active && !(cause instanceof ApiClientError && cause.status === 401)) setError(cause.message); });
    return () => { active = false; };
  }, [reloadOrganizations]);
  return { user, setUser, memberships, workerProfiles, setWorkerProfiles, organization, setOrganization, organizations, reloadOrganizations, error, setError, notice, setNotice, busy, run };
}

function ApiSignIn({ message = 'Sign in to use the factory workspace.' }) {
  return <section className="card-panel" style={{ padding: 24 }}><h2>Factory workspace needs your account</h2><p>{message} Sign in or create an account in the API workspace first.</p><a className="outline-button" href="#/api">Open API workspace</a></section>;
}

function FactoryFrame({ data, children }) {
  const { user, organization, organizations, reloadOrganizations, setOrganization, busy, run, error, setError, notice, setNotice } = data;
  const [orgName, setOrgName] = useState('');
  const createOrganization = (event) => {
    event.preventDefault();
    void run(async () => {
      const result = await skillMirrorApi.createOrganization({ name: orgName });
      setOrgName(''); await reloadOrganizations(); setOrganization(result.organization); setNotice('Factory created.');
    });
  };
  if (!user) return <ApiSignIn message="The owner and worker screens use your signed-in API account." />;
  if (!data.memberships.some((item) => item.role === 'OWNER')) return <ApiSignIn message="This account has no factory owner membership." />;
  return <div className="factory-shell">
    {error && <p role="alert" className="notice notice-warning">{error}</p>}{notice && <p role="status" className="notice">{notice}</p>}
    {organizations.length > 1 && <label className="eyebrow">FACTORY <select value={organization?.id || ''} onChange={(e) => setOrganization(organizations.find((item) => item.id === e.target.value) || null)}>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {!organization ? <section className="card-panel" style={{ padding: 24 }}><h2>Create your factory workspace</h2><p>Your owner account has no factory yet.</p><form onSubmit={createOrganization}><label>Factory name<input required minLength="2" maxLength="120" value={orgName} onChange={(e) => setOrgName(e.target.value)} /></label><button className="button button-primary" disabled={busy}><Plus size={16} />Create factory</button></form></section> : children}
  </div>;
}

function Metric({ label, value, detail, tone = 'blue', icon: Icon = BarChart3 }) {
  return <div className={`metric-card ${tone}`}><div className="metric-icon-wrap"><Icon size={18} /></div><div><span>{label}</span><strong>{value ?? '—'}</strong><small>{detail}</small></div></div>;
}

export function FactoryOwnerDashboard() {
  const data = useFactoryData(); const [overview, setOverview] = useState(null); const [showAssign, setShowAssign] = useState(false);
  const reload = useCallback(async () => { if (!data.organization) return; const result = await skillMirrorApi.ownerOverview(data.organization.id); setOverview(result); }, [data.organization]);
  useEffect(() => { void reload().catch((e) => data.setError(e.message)); }, [reload]);
  return <FactoryFrame data={data}>{<>
    <div className="page-heading"><div><span className="eyebrow">FACTORY OVERVIEW</span><h1>Operational training at a glance.</h1><p>Live workforce and training status from your factory.</p></div><div className="page-heading-action"><button className="button button-primary" onClick={() => setShowAssign(!showAssign)}><Plus size={17} />Assign training</button></div></div>
    <div className="factory-topbar card-panel"><div><span className="eyebrow">{overview?.organization?.name || data.organization.name}</span><h2>Production readiness overview</h2></div><button className="outline-button" disabled={data.busy} onClick={() => void data.run(reload)}><RefreshCw size={15}/> Refresh</button></div>
    {showAssign && <AssignTraining data={data} onDone={() => { setShowAssign(false); void reload(); }} />}
    <div className="metric-grid">
      <Metric label="Total workers" value={overview?.metrics?.totalWorkers} detail="Active in this factory" icon={Users}/>
      <Metric label="In progress" value={overview?.metrics?.trainingInProgress} detail="Assignments underway" tone="amber"/>
      <Metric label="Verified competencies" value={overview?.metrics?.verifiedCompetencies} detail="Approved skills" tone="green"/>
      <Metric label="Pending reviews" value={overview?.metrics?.pendingAssessments} detail={`${overview?.metrics?.overdueTraining ?? 0} overdue assignments`} tone="red"/>
    </div>
    <div className="factory-grid"><section className="card-panel"><h3>Recent activity</h3><ul className="activity-list">{(overview?.recentActivity || []).map((item) => <li key={item.id} className="activity-item"><span className="dot"/><div><strong>{item.action.replaceAll('_', ' ').toLowerCase()}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></div></li>)}</ul>{overview && !overview.recentActivity.length && <p>No activity yet.</p>}</section><section className="card-panel"><h3>Attention required</h3><ul className="attention-list">{(overview?.attentionRequired || []).map((item) => <li key={item.id}><strong>{item.session.learner.name}</strong> — {item.step.title} · {item.session.project.title}</li>)}</ul>{overview && !overview.attentionRequired.length && <p>Nothing needs review right now.</p>}</section></div>
  </>}</FactoryFrame>;
}

function AssignTraining({ data, onDone }) {
  const [workers, setWorkers] = useState([]); const [trainings, setTrainings] = useState([]); const [workerId, setWorkerId] = useState(''); const [trainingId, setTrainingId] = useState(''); const [dueAt, setDueAt] = useState('');
  const [createMode, setCreateMode] = useState(false); const [newTraining, setNewTraining] = useState({ title: '', description: '', stepTitle: '', instructions: '' });
  useEffect(() => { if (!data.organization) return; Promise.all([skillMirrorApi.listWorkers(data.organization.id, { pageSize: 50 }), skillMirrorApi.listOrganizationTrainings(data.organization.id)]).then(([w, t]) => { setWorkers(w.items.filter((x) => x.status === 'ACTIVE')); setTrainings(t.items.filter((x) => x.status === 'published')); }).catch((e) => data.setError(e.message)); }, [data.organization]);
  const submit = (event) => { event.preventDefault(); void data.run(async () => { await skillMirrorApi.assignTraining(data.organization.id, { trainingId, workerProfileIds: [workerId], dueAt: dueAt ? new Date(dueAt).toISOString() : null, requiresOwnerApproval: true }); data.setNotice('Training assigned.'); onDone(); }); };
  const createPublished = (event) => { event.preventDefault(); void data.run(async () => { const created = await skillMirrorApi.createOrganizationTraining(data.organization.id, { title: newTraining.title, description: newTraining.description, category: 'Other', level: 'Beginner', duration: 15, objectives: '', materials: [], status: 'published', steps: [{ title: newTraining.stepTitle, instructions: newTraining.instructions, expected: '', verification: '' }] }); setTrainings((current) => [created, ...current]); setTrainingId(created.id); setCreateMode(false); data.setNotice('Published training created and ready to assign.'); }); };
  return <section className="card-panel" style={{ padding: 20 }}><h3>Assign training</h3>{(!workers.length || !trainings.length) && <p>Add active workers and publish a training guide before assigning it.</p>}
    <form onSubmit={submit}><label>Training<select required value={trainingId} onChange={(e) => setTrainingId(e.target.value)}><option value="">Select training</option>{trainings.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label><label>Worker<select required value={workerId} onChange={(e) => setWorkerId(e.target.value)}><option value="">Select worker</option>{workers.map((x) => <option key={x.id} value={x.id}>{x.fullName} ({x.employeeId})</option>)}</select></label><label>Due date<input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></label><button className="button button-primary" disabled={data.busy || !workers.length || !trainings.length}>Assign</button><button type="button" className="outline-button" onClick={onDone}>Cancel</button></form>
    <button type="button" className="outline-button" onClick={() => setCreateMode(!createMode)}>{createMode ? 'Close training form' : 'Create published training'}</button>
    {createMode && <form onSubmit={createPublished}><h4>New training</h4><label>Title<input required maxLength="120" value={newTraining.title} onChange={(e)=>setNewTraining({...newTraining,title:e.target.value})}/></label><label>Description<textarea required maxLength="1000" value={newTraining.description} onChange={(e)=>setNewTraining({...newTraining,description:e.target.value})}/></label><label>First step<input required maxLength="120" value={newTraining.stepTitle} onChange={(e)=>setNewTraining({...newTraining,stepTitle:e.target.value})}/></label><label>Instructions<textarea required maxLength="2000" value={newTraining.instructions} onChange={(e)=>setNewTraining({...newTraining,instructions:e.target.value})}/></label><button className="button button-primary" disabled={data.busy}>Publish training</button></form>}
  </section>;
}

export function WorkersPage() {
  const data = useFactoryData(); const [workers, setWorkers] = useState([]); const [search, setSearch] = useState(''); const [adding, setAdding] = useState(false); const [worker, setWorker] = useState({ fullName: '', email: '', employeeId: '', department: '' }); const [invitation, setInvitation] = useState(null);
  const reload = useCallback(async () => { if (!data.organization) return; const result = await skillMirrorApi.listWorkers(data.organization.id, { pageSize: 50, search }); setWorkers(result.items); }, [data.organization, search]);
  useEffect(() => { void reload().catch((e) => data.setError(e.message)); }, [reload]);
  const submit = (event) => { event.preventDefault(); void data.run(async () => { const result = await skillMirrorApi.addWorker(data.organization.id, worker); const addedName = worker.fullName; setWorker({ fullName: '', email: '', employeeId: '', department: '' }); setAdding(false); setInvitation({ ...result.invitation, workerName: addedName }); await reload(); data.setNotice('Worker added. Share the invitation token with them; email delivery is not configured.'); }); };
  return <FactoryFrame data={data}>{<><div className="page-heading"><div><span className="eyebrow">WORKER MANAGEMENT</span><h1>Factory workforce</h1><p>Search active worker profiles and their training assignments.</p></div><button className="button button-primary" onClick={() => setAdding(!adding)}><Plus size={16}/>{adding ? 'Close' : 'Add worker'}</button></div>
    {invitation && <section className="card-panel" style={{ padding: 16 }}><strong>Invitation for {invitation.workerName} (expires {new Date(invitation.expiresAt).toLocaleString()})</strong><p>Email delivery is not configured. Share this token securely with the worker.</p><code style={{ overflowWrap: 'anywhere' }}>{invitation.token}</code><button className="outline-button" onClick={() => setInvitation(null)}>Dismiss</button></section>}
    {adding && <form className="card-panel" style={{ padding: 20 }} onSubmit={submit}><h3>Add worker</h3>{[['fullName','Full name','text'],['email','Email','email'],['employeeId','Employee ID','text'],['department','Department','text']].map(([key,label,type])=><label key={key}>{label}<input type={type} required={key!=='department'} autoComplete={key==='email'?'email':key==='fullName'?'name':'off'} value={worker[key]} onChange={(e)=>setWorker({...worker,[key]:e.target.value})}/></label>)}<button className="button button-primary" disabled={data.busy}>Add worker</button></form>}
    <section className="card-panel table-panel"><label>Search workers<input type="search" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Name or employee ID" /></label><table className="worker-table"><thead><tr><th>Worker</th><th>Employee ID</th><th>Department</th><th>Training</th><th>Status</th></tr></thead><tbody>{workers.map((x)=><tr key={x.id}><td>{x.fullName}<small>{x.email}</small></td><td>{x.employeeId}</td><td>{x.department || '—'}</td><td>{x.assignments?.map((a)=>a.training.title).join(', ') || 'None'}</td><td>{x.status}</td></tr>)}</tbody></table>{!workers.length && <p>No workers found.</p>}</section>
  </>}</FactoryFrame>;
}

export function FactoryReportsPage() {
  const data = useFactoryData(); const [report, setReport] = useState(null);
  const reload = useCallback(async () => { if (data.organization) setReport(await skillMirrorApi.ownerReports(data.organization.id)); }, [data.organization]);
  useEffect(() => { void reload().catch((e) => data.setError(e.message)); }, [reload]);
  const exportCsv = () => { if (!data.organization) return; const link = document.createElement('a'); link.href = skillMirrorApi.ownerReportExportUrl(data.organization.id); link.download = 'skillmirror-report.csv'; link.click(); };
  return <FactoryFrame data={data}>{<><div className="page-heading"><div><span className="eyebrow">REPORTS</span><h1>Factory performance</h1><p>Live assignment completion and competence statistics.</p></div><button className="button button-primary" onClick={exportCsv}><BarChart3 size={16}/>Export CSV</button></div><div className="metric-grid"><Metric label="Completed assignments" value={`${report?.summary?.completionPercentage ?? 0}%`} detail={`${report?.summary?.completed ?? 0} of ${report?.summary?.assigned ?? 0}`} tone="green"/><Metric label="Verified competencies" value={report?.summary?.verifiedCompetencies} detail="Verified on record"/><Metric label="Overdue tasks" value={report?.summary?.overdue} detail="Requires follow-up" tone="amber"/><Metric label="Pending assessments" value={report?.summary?.pendingAssessments} detail="Waiting for review" tone="red"/></div><section className="card-panel table-panel"><h3>Assignment report</h3><table className="worker-table"><thead><tr><th>Worker</th><th>Department</th><th>Training</th><th>Status</th><th>Due</th></tr></thead><tbody>{(report?.assignments||[]).map((a)=><tr key={a.id}><td>{a.worker.fullName}</td><td>{a.worker.department||'—'}</td><td>{a.training.title}</td><td>{a.status}</td><td>{a.dueAt?new Date(a.dueAt).toLocaleDateString():'—'}</td></tr>)}</tbody></table>{report && !report.assignments.length && <p>No assignments to report yet.</p>}</section></>}</FactoryFrame>;
}

export function WorkerPortal({ onIdentityChange }) {
  const data = useFactoryData(); const [assignments, setAssignments] = useState([]); const [invitationToken, setInvitationToken] = useState('');
  const reload = useCallback(async () => { const result = await skillMirrorApi.workerAssignments(); setAssignments(result.assignments || []); }, []);
  useEffect(() => { if (data.user) void reload().catch((e)=>data.setError(e.message)); }, [data.user, reload]);
  if (!data.user) return <ApiSignIn message="Sign in with the account that accepted your worker invitation."/>;
  if (!data.workerProfiles.length) return <div><ApiSignIn message="Sign in with the email address that received your factory invitation."/><form className="card-panel" style={{ padding: 20 }} onSubmit={(event)=>{event.preventDefault();void data.run(async()=>{const result=await skillMirrorApi.acceptWorkerInvitation(invitationToken.trim());data.setWorkerProfiles((items)=>[...items,result.worker]);const identity=await skillMirrorApi.me();onIdentityChange?.(identity);setInvitationToken('');await reload();});}}><label>Invitation token<input required minLength="32" maxLength="128" value={invitationToken} onChange={(e)=>setInvitationToken(e.target.value)} autoComplete="off" /></label><button className="button button-primary" disabled={data.busy}>Accept invitation</button></form></div>;
  const start = (assignment) => { void data.run(async () => { const result=await skillMirrorApi.startAssignedSession(assignment.id); window.location.hash=`#/api/session/${result.id}`; }); };
  return <div><div className="page-heading"><div><span className="eyebrow">WORKER PORTAL</span><h1>Your assigned training</h1><p>Assignments and due dates from your factory.</p></div><button className="outline-button" onClick={()=>void data.run(reload)} disabled={data.busy}><RefreshCw size={15}/>Refresh</button></div>{data.error&&<p role="alert" className="notice notice-warning">{data.error}</p>}<div className="worker-portal-grid">{assignments.map((a)=><div key={a.id} className="card-panel assignment-card"><div className="panel-title-row compact"><div><span className="eyebrow">{a.organization?.name||'ASSIGNMENT'}</span><h3>{a.training.title}</h3></div><span className="mini-pill neutral">{a.effectiveStatus}</span></div><p>{a.dueAt?`Due ${new Date(a.dueAt).toLocaleDateString()}`:'No due date'} · {a.training.steps?.length||0} steps</p><button className="outline-button full" disabled={data.busy||['COMPLETED','APPROVED'].includes(a.status)} onClick={()=>start(a)}><BookOpen size={15}/>{a.sessions?.length?'Continue training':'Start training'}</button></div>)}</div>{!assignments.length&&<section className="card-panel" style={{padding:20}}>No training assignments yet. Ask your factory owner to assign one.</section>}</div>;
}
