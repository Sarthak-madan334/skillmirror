import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BadgeCheck, BarChart3, BookOpen, Check, CheckCircle2,
  ChevronDown, CircleHelp, Clock3, Copy, FileVideo2, FlaskConical, FolderOpen, Gauge,
  ImagePlus, Layers3, ListChecks, Menu, MoreHorizontal, Play, Plus, RotateCcw, Save,
  Search, Server, Settings2, ShieldCheck, Sparkles, Trash2, Upload, Users, X,
} from 'lucide-react';
import ApiWorkspace from './ApiWorkspace.jsx';
import { createBlankTraining, createId, createSampleSteps, EXAMPLE_ID, EXAMPLE_TRAINING } from './data.js';
import { readStore, writeStore } from './persistence.js';

const OWNER_NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: Gauge },
  { path: '/workers', label: 'Workers', icon: Users },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/library', label: 'Training', icon: Layers3 },
  { path: '/api', label: 'API workspace', icon: Server },
];

const WORKER_NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: Gauge },
  { path: '/assignments', label: 'Assignments', icon: BookOpen },
  { path: '/progress', label: 'Progress', icon: ListChecks },
  { path: '/library', label: 'Library', icon: Layers3 },
];

const NAV_ITEMS = OWNER_NAV_ITEMS;

function routeFromHash() {
  const segments = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { view: segments[0] || 'dashboard', id: segments[1] || '', step: segments.length > 2 ? Number(segments[2]) : null };
}

function navigate(path) {
  window.location.hash = path;
}

function Button({ children, icon: Icon, variant = 'primary', className = '', ...props }) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {Icon && <Icon size={17} strokeWidth={1.9} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

function Status({ children, tone = 'neutral' }) {
  return <span className={`status status-${tone}`}><span className="status-dot" />{children}</span>;
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}

function FactoryOwnerDashboard() {
  const metrics = [
    { label: 'Total workers', value: '48', tone: 'blue', detail: 'Active in the plant', icon: Users },
    { label: 'In progress', value: '12', tone: 'amber', detail: 'Assignments underway', icon: Clock3 },
    { label: 'Verified competencies', value: '131', tone: 'green', detail: 'Approved skills on file', icon: BadgeCheck },
    { label: 'Pending reviews', value: '7', tone: 'red', detail: 'Needs owner sign-off', icon: ShieldCheck },
  ];
  const activity = [
    { title: 'Alicia Grant started the CNC safety module', time: '12 minutes ago', tone: 'info' },
    { title: 'Equipment calibration training was marked for review', time: '1 hour ago', tone: 'warn' },
    { title: 'Mason Lee completed the line changeover assessment', time: 'Today', tone: 'success' },
  ];
  const attention = [
    'Two workers still need their PPE induction sign-out.',
    'Three practical checkpoints were submitted and waiting for review.',
    'One maintenance assignment is due tomorrow.',
  ];

  return (
    <div className="factory-shell">
      <PageHeading
        eyebrow="FACTORY OVERVIEW"
        title="Operational training at a glance."
        description="Monitor progress, verify demonstrated skills, and keep the workforce aligned to current procedures."
        action={<Button icon={Plus}>Assign training</Button>}
      />

      <div className="factory-topbar card-panel">
        <div>
          <span className="eyebrow">Northline Manufacturing</span>
          <h2>Production readiness overview</h2>
        </div>
        <div className="factory-actions">
          <button className="outline-button">Add worker</button>
          <Button icon={Plus}>Assign training</Button>
        </div>
      </div>

      <div className="metric-grid">
        {metrics.map(({ label, value, tone, detail, icon: Icon }) => (
          <div key={label} className={`metric-card ${tone}`}>
            <div className="metric-icon-wrap">
              <Icon size={18} />
            </div>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{detail}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="factory-grid">
        <section className="card-panel">
          <div className="panel-title-row">
            <div>
              <span className="eyebrow">RECENT ACTIVITY</span>
              <h3>Recent updates</h3>
            </div>
          </div>
          <ul className="activity-list">
            {activity.map((item) => (
              <li key={item.title} className={`activity-item ${item.tone}`}>
                <span className="dot" />
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.time}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card-panel">
          <div className="panel-title-row">
            <div>
              <span className="eyebrow">ATTENTION REQUIRED</span>
              <h3>Priority follow-ups</h3>
            </div>
          </div>
          <ul className="attention-list">
            {attention.map((item) => (
              <li key={item}><ShieldCheck size={14} /> {item}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function WorkersPage() {
  const workers = [
    { name: 'Alicia Grant', employeeId: 'NW-2148', department: 'CNC', training: 'Safety induction', status: 'In progress', competence: '3 of 5 checks', review: '2 pending', lastActivity: '2 hours ago' },
    { name: 'Mason Lee', employeeId: 'NW-1037', department: 'Assembly', training: 'Line changeover', status: 'Ready to review', competence: '5 of 5 checks', review: '1 pending', lastActivity: 'Today' },
    { name: 'Rosa Patel', employeeId: 'NW-4411', department: 'Quality', training: 'Inspection standard', status: 'Verified', competence: 'Verified', review: 'None', lastActivity: 'Yesterday' },
  ];

  return (
    <div>
      <PageHeading
        eyebrow="WORKER MANAGEMENT"
        title="Factory workforce overview."
        description="Search workers, review active assignments, and monitor the training path that leads to verified competence."
        action={<Button icon={Plus}>Add worker</Button>}
      />

      <div className="card-panel table-panel">
        <div className="panel-title-row flush">
          <div>
            <span className="eyebrow">WORKERS</span>
            <h3>Active team</h3>
          </div>
          <div className="toolbar-actions">
            <button className="outline-button">Filter</button>
            <button className="outline-button">Search</button>
          </div>
        </div>

        <table className="worker-table">
          <thead>
            <tr>
              <th>Worker</th>
              <th>Employee ID</th>
              <th>Department</th>
              <th>Assigned training</th>
              <th>Competence</th>
              <th>Pending review</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => (
              <tr key={worker.employeeId}>
                <td>{worker.name}</td>
                <td>{worker.employeeId}</td>
                <td>{worker.department}</td>
                <td>{worker.training}</td>
                <td><span className="mini-pill success">{worker.competence}</span></td>
                <td><span className="mini-pill warn">{worker.review}</span></td>
                <td>{worker.lastActivity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FactoryReportsPage() {
  const summary = [
    { label: 'Completed assignments', value: '62%', detail: '18 of 29', tone: 'green' },
    { label: 'Verified competencies', value: '80%', detail: '24 of 30', tone: 'blue' },
    { label: 'Overdue tasks', value: '4', detail: 'Requires follow-up', tone: 'amber' },
  ];

  return (
    <div>
      <PageHeading
        eyebrow="REPORTS"
        title="Factory performance and training health."
        description="Keep the review focused on completed assignments, verified skills, and overdue operator readiness checks."
        action={<Button icon={BarChart3}>Export CSV</Button>}
      />

      <div className="metric-grid">
        {summary.map(({ label, value, detail, tone }) => (
          <div key={label} className={`metric-card ${tone}`}>
            <div className="metric-icon-wrap"><BarChart3 size={18} /></div>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{detail}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkerPortal() {
  const assignments = [
    { title: 'CNC Safety Induction', status: 'In progress', due: 'Due in 3 days', actions: 'Continue' },
    { title: 'Line Changeover Basics', status: 'Needs review', due: 'Evidence submitted', actions: 'Review' },
    { title: 'Inspection Standard', status: 'Ready', due: 'Due in 6 days', actions: 'Start' },
  ];

  return (
    <div>
      <PageHeading
        eyebrow="WORKER PORTAL"
        title="Your assigned training."
        description="Complete the required steps, submit evidence, and keep your practical skill records current."
      />

      <div className="worker-portal-grid">
        {assignments.map((assignment) => (
          <div key={assignment.title} className="card-panel assignment-card">
            <div className="panel-title-row compact">
              <div>
                <span className="eyebrow">ASSIGNMENT</span>
                <h3>{assignment.title}</h3>
              </div>
              <span className="mini-pill neutral">{assignment.status}</span>
            </div>
            <p>{assignment.due}</p>
            <button className="outline-button full">{assignment.actions}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkerAssignmentsPage() {
  return <WorkerPortal />;
}

function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [role, setRole] = useState('owner');
  const [store, setStore] = useState(() => readStore().data);
  const [recoveredData, setRecoveredData] = useState(() => readStore().recovered);
  const [storageError, setStorageError] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const updateRoute = () => { setRoute(routeFromHash()); setMobileNavOpen(false); };
    window.addEventListener('hashchange', updateRoute);
    if (!window.location.hash) navigate('/landing');
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  useEffect(() => {
    setStorageError(!writeStore(store));
  }, [store]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeProject = useMemo(() => {
    if (route.id === EXAMPLE_ID) return EXAMPLE_TRAINING;
    return store.projects.find((project) => project.id === route.id) ?? null;
  }, [route.id, store.projects]);

  const navItems = role === 'owner' ? OWNER_NAV_ITEMS : WORKER_NAV_ITEMS;

  const saveProject = (project) => {
    setStore((current) => ({
      ...current,
      projects: [project, ...current.projects.filter((item) => item.id !== project.id)],
    }));
  };

  const showToast = (message) => setToast(message);

  const renderScreen = () => {
    if (route.view === 'landing') return <LandingPage />;
    if (route.view === 'workers') return <WorkersPage />;
    if (route.view === 'reports') return <FactoryReportsPage />;
    if (route.view === 'assignments') return <WorkerAssignmentsPage />;
    if (route.view === 'dashboard') return role === 'owner' ? <FactoryOwnerDashboard /> : <WorkerPortal />;
    if (route.view === 'create') {
      const project = route.id ? store.projects.find((item) => item.id === route.id) : null;
      return <Builder key={route.id || 'new'} initialProject={project} onSave={saveProject} onToast={showToast} />;
    }
    if (route.view === 'detail' && activeProject) {
      return <TrainingDetail project={activeProject} store={store} onDuplicate={(copy) => { saveProject(copy); navigate(`/create/${copy.id}`); }} />;
    }
    if (route.view === 'learn' && activeProject) {
      return <LearnerMode project={activeProject} routeStep={route.step} store={store} setStore={setStore} />;
    }
    if (route.view === 'report' && activeProject) {
      return <AssessmentReport project={activeProject} store={store} />;
    }
    if (route.view === 'library') return <Library projects={store.projects} />;
    if (route.view === 'progress') return <Progress projects={store.projects} sessions={store.sessions} />;
    if (route.view === 'api') return <ApiWorkspace />;
    return role === 'owner' ? <FactoryOwnerDashboard /> : <WorkerPortal />;
  };

  if (route.view === 'landing') return <LandingPage />;

  const focused = ['learn', 'report'].includes(route.view);
  if (focused) return <main className="focused-shell">{renderScreen()}{toast && <div className="toast" role="status">{toast}</div>}</main>;

  return (
    <div className="app-shell">
      <aside id="main-sidebar" className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <button className="sidebar-close icon-button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={19} /></button>
        <a className="brand" href="#/landing" aria-label="SkillMirror landing page">
          <span className="brand-mark"><span /><span /><span /></span>
          <span className="brand-copy"><strong>SkillMirror AI</strong><small>{role === 'owner' ? 'Factory operations' : 'Worker learning'}</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <div className="role-switch" aria-label="Workspace role switch">
          <button className={role === 'owner' ? 'active' : ''} onClick={() => setRole('owner')}>Owner</button>
          <button className={role === 'worker' ? 'active' : ''} onClick={() => setRole('worker')}>Worker</button>
        </div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navItems.map(({ path, label, icon: Icon }) => (
            <a key={path} href={`#${path}`} className={`nav-link ${route.view === path.slice(1) ? 'nav-link-active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
              {path === '/library' && store.projects.length > 0 && <span className="nav-count">{store.projects.length}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <div className="sidebar-note-icon"><ShieldCheck size={18} /></div>
          <strong>{role === 'owner' ? 'Owner-only controls' : 'Practice-first workflow'}</strong>
          <p>{role === 'owner' ? 'Review assigned training, evidence, and competency approvals.' : 'Stay focused on the current assignment and required checks.'}</p>
        </div>
        <div className="profile-row">
          <div className="avatar">{role === 'owner' ? 'FO' : 'WL'}</div>
          <div className="profile-copy"><strong>{role === 'owner' ? 'Factory owner' : 'Worker profile'}</strong><small>{role === 'owner' ? 'Northline Manufacturing' : 'Ready for learning'}</small></div>
          <Settings2 size={17} aria-hidden="true" />
        </div>
      </aside>
      {mobileNavOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileNavOpen} aria-controls="main-sidebar" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{navItems.find((item) => item.path === `/${route.view}`)?.label ?? (route.view === 'create' ? 'Create training' : 'Overview')}</strong></div>
          <div className="topbar-actions"><button className="top-search" aria-label="Search training" onClick={() => navigate('/library')}><Search size={17} /><span>Find training</span><kbd>/</kbd></button>{route.view !== 'api' && <Button icon={Plus} onClick={() => navigate('/create')}>Create training</Button>}</div>
        </header>
        <main className="content-area">
          {recoveredData && <div className="notice notice-warning" role="status"><CircleHelp size={17} /><span>Saved browser data could not be read. A fresh workspace is ready; older data was left untouched.</span><button aria-label="Dismiss" onClick={() => setRecoveredData(false)}><X size={16} /></button></div>}
          {storageError && <div className="notice notice-warning" role="status"><CircleHelp size={17} /><span>Browser storage is unavailable or full. Changes may not survive a refresh.</span></div>}
          {renderScreen()}
        </main>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {navItems.map(({ path, label, icon: Icon }) => <a key={path} href={`#${path}`} className={route.view === path.slice(1) ? 'mobile-nav-active' : ''}><Icon size={19} /><span>{label}</span></a>)}
      </nav>
    </div>
  );
}

function LandingPage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Landing page navigation">
        <a className="landing-brand" href="#/landing" aria-label="SkillMirror home"><span className="brand-mark"><span /><span /><span /></span><span>skillmirror</span></a>
        <div className="landing-nav-links"><a href="#how-it-works">How it works</a><a href="#/dashboard">Open workspace</a></div>
        <button className="landing-nav-cta" onClick={() => navigate('/create')}>Start building <ArrowRight size={15} /></button>
      </nav>
      <section className="landing-hero">
        <div className="landing-orbit landing-orbit-one" /><div className="landing-orbit landing-orbit-two" />
        <div className="landing-hero-copy"><span className="landing-kicker"><Sparkles size={14} /> INTRODUCING SKILLMIRROR</span><h1>Practice<br /><em>with purpose.</em></h1><p>A skill. A guide. A better way to learn by doing.</p><div className="landing-actions"><button className="landing-primary" onClick={() => navigate('/create')}>Make a practice guide <ArrowRight size={17} /></button><a className="landing-secondary" href="#how-it-works"><Play size={15} /> See how it works</a></div><div className="landing-proof"><span><CheckCircle2 size={15} /> Step-by-step guidance</span><span><CheckCircle2 size={15} /> Human-friendly feedback</span></div></div>
        <DemoPreview />
      </section>
      <section id="how-it-works" className="landing-story"><div className="landing-story-heading"><span className="eyebrow">FROM KNOW-HOW TO DOING</span><h2>A better way to pass on<br />the things worth knowing.</h2></div><div className="landing-story-grid"><article><span>01</span><h3>Capture the method</h3><p>Describe the task in your own words and attach a demonstration when it helps.</p></article><article><span>02</span><h3>Shape the checkpoints</h3><p>Turn a messy process into focused steps with expected results and self-checks.</p></article><article><span>03</span><h3>Practise with purpose</h3><p>Follow the guide, reflect on the attempt, and make the next round better.</p></article></div></section>
      <section className="landing-bottom-cta"><span className="landing-kicker">READY WHEN YOU ARE</span><h2>Start with one skill<br />you know well.</h2><button className="landing-primary" onClick={() => navigate('/create')}>Build your first guide <ArrowRight size={17} /></button></section>
      <footer className="landing-footer"><a className="landing-brand" href="#/landing"><span className="brand-mark"><span /><span /><span /></span><span>skillmirror</span></a><span>Practice, not proof.</span></footer>
    </main>
  );
}

function Dashboard({ projects, sessions }) {
  const recent = projects.slice(0, 3);
  const completedSessions = Object.entries(sessions).filter(([id, session]) => id !== EXAMPLE_ID && session.completed).length;
  const totalSteps = projects.reduce((sum, project) => sum + project.steps.length, 0);
  return (
    <>
      <section className="welcome-banner">
        <div className="welcome-copy"><span className="eyebrow eyebrow-light"><span className="eyebrow-spark"><Sparkles size={13} /></span> YOUR PRACTICE SPACE</span><h1>Turn know-how<br />into <em>muscle memory.</em></h1><p>Build a clear guide from a practical skill. Then practise one focused step at a time.</p><div className="welcome-actions"><Button icon={Plus} onClick={() => navigate('/create')}>Create training</Button><button className="text-button text-button-light" onClick={() => navigate(`/detail/${EXAMPLE_ID}`)}><BookOpen size={17} /> Explore the example <ArrowRight size={16} /></button></div></div>
        <DemoPreview />
      </section>

      <div className="dashboard-intro"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>A little progress, made visible.</h2></div><span className="local-chip"><span /> Saved in this browser</span></div>
      <div className="overview-strip" aria-label="Workspace summary">
        <div className="overview-item"><span className="overview-icon overview-icon-blue"><Layers3 size={18} /></span><div><strong>{projects.length}</strong><span>Training guides</span></div></div>
        <div className="overview-item"><span className="overview-icon overview-icon-orange"><ListChecks size={18} /></span><div><strong>{totalSteps}</strong><span>Steps to practise</span></div></div>
        <div className="overview-item"><span className="overview-icon overview-icon-green"><BadgeCheck size={18} /></span><div><strong>{completedSessions}</strong><span>Sessions finished</span></div></div>
        <div className="overview-footnote">Only your own saved work appears here. Examples stay separate.</div>
      </div>

      <div className="section-heading"><div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Recent training</h2></div>{projects.length > 0 && <button className="link-button" onClick={() => navigate('/library')}>View all <ArrowRight size={15} /></button>}</div>
      {recent.length > 0 ? <div className="training-grid">{recent.map((project) => <TrainingCard key={project.id} project={project} />)}</div> : <div className="empty-workspace"><div className="empty-illustration"><span className="empty-sheet"><span /><span /><span /></span><span className="empty-spark empty-spark-one">✳</span><span className="empty-spark empty-spark-two">✳</span></div><div className="empty-copy"><span className="eyebrow">A FRESH START</span><h3>Your first training guide starts here.</h3><p>Describe a task you know well, add a few clear steps, and turn it into a guide someone else can practise.</p><Button icon={Plus} onClick={() => navigate('/create')}>Create your first guide</Button></div><div className="empty-steps"><div><span>01</span><strong>Describe</strong><small>What should someone learn?</small></div><div><span>02</span><strong>Break it down</strong><small>Write the steps and checks.</small></div><div><span>03</span><strong>Practise</strong><small>Follow the guide and reflect.</small></div></div></div>}

      <section className="example-band"><div className="example-band-copy"><span className="eyebrow">NOT SURE WHERE TO START?</span><h2>Take a guided practice run.</h2><p>Explore a sample paper-bridge lesson. It includes example steps and clearly labelled self-checks.</p><button className="link-button" onClick={() => navigate(`/detail/${EXAMPLE_ID}`)}>Open the sample <ArrowRight size={15} /></button></div><div className="example-band-image" role="img" aria-label="Creative workspace with paper and art materials"><span className="sample-stamp"><FlaskConical size={14} /> SAMPLE</span></div></section>
    </>
  );
}

function DemoPreview() {
  const [phase, setPhase] = useState(0);
  const phases = [
    { label: 'DESCRIBE', title: 'Turn a task into a guide', detail: 'Make a clear learning path from what you already know.', icon: FileVideo2 },
    { label: 'BUILD STEPS', title: 'Break it into checkpoints', detail: 'Each step gets an instruction, expected result, and self-check.', icon: ListChecks },
    { label: 'PRACTISE', title: 'Follow one step at a time', detail: 'Learners focus, reflect, and keep their momentum.', icon: Play },
    { label: 'IMPROVE', title: 'See what to try next', detail: 'A simple practice record makes progress visible.', icon: BadgeCheck },
  ];

  useEffect(() => {
    const timer = window.setInterval(() => setPhase((current) => (current + 1) % phases.length), 3600);
    return () => window.clearInterval(timer);
  }, [phases.length]);

  const current = phases[phase];
  const Icon = current.icon;
  return (
    <div className="demo-preview" aria-label={`Animated product demo: ${current.label.toLowerCase()}`}>
      <div className="demo-preview-glow" />
      <div className="demo-preview-topline"><span className="art-label-dot" /> LIVE PRODUCT TOUR <span className="demo-preview-counter">0{phase + 1}<i> / 04</i></span></div>
      <div className="demo-window">
        <div className="demo-window-bar"><span /><span /><span /><small>skillmirror / practice studio</small></div>
        <div className="demo-window-body">
          <div className="demo-sidebar-lines"><span /><span /><span /><span /></div>
          <div className="demo-content-lines">
            <span className="demo-mini-label">{current.label}</span>
            <strong>{current.title}</strong>
            <p>{current.detail}</p>
            <div className="demo-progress"><span style={{ width: `${((phase + 1) / phases.length) * 100}%` }} /></div>
            <div className="demo-card-row"><div><Icon size={15} /><span>Checkpoint {phase + 1}</span></div><em>{phase === 2 ? 'In practice' : 'Ready'}</em></div>
          </div>
        </div>
      </div>
      <div className="demo-preview-caption"><span>WATCH IT TAKE SHAPE</span><strong>{current.label.toLowerCase()} → practise with purpose</strong></div>
      <div className="demo-dots" aria-hidden="true">{phases.map((item, index) => <span key={item.label} className={index === phase ? 'demo-dot-active' : ''} />)}</div>
    </div>
  );
}

function TrainingCard({ project, compact = false }) {
  const progress = project.steps.length ? Math.round(((project.completedCount || 0) / project.steps.length) * 100) : 0;
  return <button className={`training-card ${compact ? 'training-card-compact' : ''}`} onClick={() => navigate(`/detail/${project.id}`)}><div className={`training-card-cover ${project.id === EXAMPLE_ID ? 'training-card-cover-example' : ''}`}><div className="cover-glyph"><Layers3 size={24} /></div><span className={`card-status ${project.status === 'draft' ? 'card-status-draft' : 'card-status-ready'}`}>{project.status === 'draft' ? 'Draft' : 'Ready to practise'}</span><span className="cover-category">{project.category || 'Uncategorized'}</span></div><div className="training-card-body"><div className="training-card-title"><h3>{project.title || 'Untitled training'}</h3><MoreHorizontal size={19} /></div><p>{project.description || 'Add a short description to help learners understand this task.'}</p><div className="training-card-meta"><span><ListChecks size={15} /> {project.steps.length} steps</span><span><Clock3 size={15} /> {project.duration || 15} min</span></div><div className="card-progress-row"><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><span>{progress}%</span></div></div></button>;
}

function Library({ projects }) {
  return <><PageHeading eyebrow="YOUR LIBRARY" title="Training guides" description="Create, edit, and practise the skills you want to share." action={<Button icon={Plus} onClick={() => navigate('/create')}>Create training</Button>} /><div className="library-filters"><span className="filter-pill filter-pill-active">All guides <span>{projects.length}</span></span><span className="library-hint"><ShieldCheck size={15} /> Examples are kept separate from your own guides</span></div>{projects.length ? <div className="training-grid">{projects.map((project) => <TrainingCard key={project.id} project={project} />)}</div> : <div className="library-empty"><FolderOpen size={25} /><h2>No guides yet</h2><p>Your training guides will appear here after you save a draft or publish one locally.</p><Button icon={Plus} onClick={() => navigate('/create')}>Create your first guide</Button></div>}<div className="sample-library"><div className="sample-library-header"><div><span className="eyebrow">A READY-MADE WALKTHROUGH</span><h2>Explore a sample</h2></div><span className="sample-only-label">Separate from your work</span></div><TrainingCard project={EXAMPLE_TRAINING} compact /></div></>;
}

function Progress({ projects, sessions }) {
  const tracked = projects.filter((project) => sessions[project.id]);
  const finished = tracked.filter((project) => sessions[project.id]?.completed).length;
  return <><PageHeading eyebrow="YOUR PRACTICE" title="Progress, at your pace." description="A record of your own practice sessions saved in this browser." /><div className="progress-summary"><div className="progress-summary-main"><span className="overview-icon overview-icon-green"><BadgeCheck size={19} /></span><div><strong>{finished}</strong><span>finished sessions</span></div></div><p>Progress reflects steps you marked complete. It is not an AI assessment or a measure of skill mastery.</p></div>{tracked.length ? <div className="progress-list">{tracked.map((project) => { const session = sessions[project.id]; const done = session.results?.filter((result) => result.status === 'completed').length || 0; const pct = project.steps.length ? Math.round((done / project.steps.length) * 100) : 0; return <button className="progress-row" key={project.id} onClick={() => navigate(session.completed ? `/report/${project.id}` : `/learn/${project.id}`)}><div className="progress-row-copy"><strong>{project.title}</strong><span>{session.completed ? 'Session finished' : 'In progress'} · {done} of {project.steps.length} steps self-checked</span></div><div className="progress-row-meter"><div className="progress-track"><span style={{ width: `${pct}%` }} /></div><span>{pct}%</span></div><ArrowRight size={18} /></button>; })}</div> : <div className="library-empty"><ListChecks size={25} /><h2>Your practice history will appear here.</h2><p>Start a guide and mark a few steps complete to create a local progress record.</p><button className="link-button" onClick={() => navigate('/library')}>Browse training <ArrowRight size={15} /></button></div>}</>;
}

const WIZARD_STEPS = ['Describe', 'Demonstration', 'Build steps', 'Review'];

function Builder({ initialProject, onSave, onToast }) {
  const [project, setProject] = useState(() => initialProject ? structuredClone(initialProject) : createBlankTraining());
  const [stage, setStage] = useState(0);
  const [errors, setErrors] = useState({});
  const [localVideoUrl, setLocalVideoUrl] = useState('');
  const [confirmRemove, setConfirmRemove] = useState('');
  const [mobilePreview, setMobilePreview] = useState(false);

  useEffect(() => () => { if (localVideoUrl) URL.revokeObjectURL(localVideoUrl); }, [localVideoUrl]);

  const update = (key, value) => setProject((current) => ({ ...current, [key]: value }));
  const updateStep = (id, key, value) => update('steps', project.steps.map((step) => step.id === id ? { ...step, [key]: value } : step));
  const validateStage = () => {
    const next = {};
    if (stage === 0) {
      if (!project.title.trim()) next.title = 'Add a title so learners know what they will practise.';
      if (!project.description.trim()) next.description = 'Add one sentence about the task.';
      if (!project.duration || Number(project.duration) < 1) next.duration = 'Enter an estimated time of at least one minute.';
    }
    if (stage === 2 && !project.steps.length) next.steps = 'Add at least one step before continuing.';
    if (stage === 2) project.steps.forEach((step) => {
      if (!step.title.trim()) next[`step-${step.id}`] = 'Every step needs a title.';
      else if (!step.instructions.trim()) next[`instruction-${step.id}`] = 'Add a short instruction for this step.';
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => { if (validateStage()) setStage((current) => Math.min(current + 1, 3)); };
  const save = (status) => {
    const missingStep = project.steps.some((step) => !step.title.trim() || !step.instructions.trim());
    if (status === 'published' && (!project.title.trim() || !project.description.trim() || !project.steps.length || missingStep)) {
      setStage(!project.title.trim() || !project.description.trim() ? 0 : 2);
      setErrors({ publish: 'Finish the required details and steps before publishing.' });
      return;
    }
    const saved = { ...project, duration: Number(project.duration) || 15, materials: Array.isArray(project.materials) ? project.materials : [], status, updatedAt: new Date().toISOString() };
    onSave(saved);
    onToast(status === 'draft' ? 'Draft saved in this browser.' : 'Training published locally and ready to practise.');
    navigate(`/detail/${saved.id}`);
  };

  const addStep = () => update('steps', [...project.steps, { id: createId(), title: '', instructions: '', expected: '', verification: '', safety: '', image: '', feedback: '' }]);
  const removeStep = (id) => {
    if (confirmRemove !== id) { setConfirmRemove(id); return; }
    update('steps', project.steps.filter((step) => step.id !== id));
    setConfirmRemove('');
  };
  const moveStep = (id, offset) => {
    const from = project.steps.findIndex((step) => step.id === id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= project.steps.length) return;
    const next = [...project.steps];
    [next[from], next[to]] = [next[to], next[from]];
    update('steps', next);
  };

  const acceptVideo = (file, input) => {
    if (!file) return;
    const accepted = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!accepted.includes(file.type)) { setErrors({ video: 'Choose an MP4, MOV, or WebM video file.' }); if (input) input.value = ''; return; }
    if (file.size > 250 * 1024 * 1024) { setErrors({ video: 'This file is larger than the 250 MB local selection limit.' }); if (input) input.value = ''; return; }
    if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
    setLocalVideoUrl(URL.createObjectURL(file));
    update('demonstration', { mode: 'local', name: file.name, size: file.size, type: file.type });
    setErrors({});
  };
  const chooseVideo = (event) => acceptVideo(event.target.files?.[0], event.target);

  const stageContent = () => {
    if (stage === 0) return <div className="form-stack"><Field label="Training title" required error={errors.title}><input autoFocus value={project.title} onChange={(event) => update('title', event.target.value)} placeholder="e.g. Make a sturdy paper bridge" maxLength={80} /></Field><Field label="What will the learner do?" required hint="Keep it to one or two clear sentences." error={errors.description}><textarea rows={3} value={project.description} onChange={(event) => update('description', event.target.value)} placeholder="Describe the task and what a good result looks like." maxLength={280} /></Field><div className="form-two-col"><Field label="Skill area"><select value={project.category} onChange={(event) => update('category', event.target.value)}><option>Maker skills</option><option>Craft and design</option><option>Food preparation</option><option>Home and garden</option><option>Other</option></select></Field><Field label="Learner level"><select value={project.level} onChange={(event) => update('level', event.target.value)}><option>Beginner</option><option>Some experience</option><option>Experienced</option></select></Field></div><div className="form-two-col"><Field label="Estimated practice time" hint="Minutes" error={errors.duration}><div className="input-suffix"><input type="number" min="1" max="600" value={project.duration} onChange={(event) => update('duration', event.target.value)} /><span>min</span></div></Field><Field label="Learning objective" hint="Optional"><input value={project.objectives} onChange={(event) => update('objectives', event.target.value)} placeholder="What should they be able to do?" maxLength={160} /></Field></div></div>;
    if (stage === 1) return <div className="demo-stage"><div className="demo-callout"><div className="demo-callout-icon"><FileVideo2 size={21} /></div><div><strong>A demonstration is a reference, not an analysis.</strong><p>This prototype can keep a video selected in this tab, but it does not upload or analyse it. You can also use the prepared sample.</p></div></div><label className="upload-zone" onDragOver={(event) => event.preventDefault()} onDragEnter={(event) => { event.preventDefault(); event.currentTarget.dataset.dragging = 'true'; }} onDragLeave={(event) => { event.currentTarget.dataset.dragging = 'false'; }} onDrop={(event) => { event.preventDefault(); event.currentTarget.dataset.dragging = 'false'; acceptVideo(event.dataTransfer.files?.[0]); }}><input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={chooseVideo} /><span className="upload-icon"><Upload size={21} /></span><strong>{project.demonstration?.mode === 'local' ? project.demonstration.name : 'Drop a demonstration video here'}</strong><span>or <u>browse files</u></span><small>MP4, MOV, or WebM · up to 250 MB · local selection only</small></label>{errors.video && <p className="field-error" role="alert">{errors.video}</p>}{project.demonstration?.mode === 'local' && localVideoUrl && <div className="video-preview"><video src={localVideoUrl} controls aria-label="Selected demonstration video" /><button className="icon-button" aria-label="Remove selected video" onClick={() => { URL.revokeObjectURL(localVideoUrl); setLocalVideoUrl(''); update('demonstration', null); }}> <X size={17} /></button></div>}<div className="sample-option"><div className="sample-option-icon"><Sparkles size={18} /></div><div><strong>Use the sample demonstration</strong><p>Build a paper bridge · a ready-made, fictional walkthrough</p></div><button className={`choice-button ${project.demonstration?.mode === 'sample' ? 'choice-button-selected' : ''}`} onClick={() => { update('demonstration', { mode: 'sample', name: 'Paper bridge demonstration (sample)' }); setErrors({}); }}>{project.demonstration?.mode === 'sample' ? <><Check size={15} /> Selected</> : 'Choose sample'}</button></div><button className="text-button" onClick={() => { update('demonstration', null); setErrors({}); }}>Continue without a demonstration</button></div>;
    if (stage === 2) return <div className="step-editor"><div className="editor-toolbar"><div><strong>{project.steps.length} {project.steps.length === 1 ? 'step' : 'steps'}</strong><span>Short, observable actions work best.</span></div><div className="editor-actions"><Button icon={Sparkles} variant="secondary" onClick={() => update('steps', createSampleSteps())}>Add sample steps</Button><Button icon={Plus} onClick={addStep}>Add step</Button></div></div>{errors.steps && <p className="field-error" role="alert">{errors.steps}</p>}{project.steps.length === 0 ? <div className="steps-empty"><ListChecks size={24} /><strong>Your steps will appear here.</strong><span>Start with a sample outline or add your first step.</span><div><Button icon={Sparkles} variant="secondary" onClick={() => update('steps', createSampleSteps())}>Use a sample outline</Button><Button icon={Plus} onClick={addStep}>Add a step</Button></div></div> : <div className="step-list">{project.steps.map((step, index) => <article className="editor-step" key={step.id}><div className="editor-step-top"><span className="step-number">{String(index + 1).padStart(2, '0')}</span><strong>Step {index + 1}</strong><div className="step-move-actions"><button className="icon-button" aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => moveStep(step.id, -1)}><ArrowUp size={16} /></button><button className="icon-button" aria-label={`Move step ${index + 1} down`} disabled={index === project.steps.length - 1} onClick={() => moveStep(step.id, 1)}><ArrowDown size={16} /></button><button className="icon-button icon-button-danger" aria-label={`Remove step ${index + 1}`} onClick={() => removeStep(step.id)}><Trash2 size={16} /></button></div></div>{confirmRemove === step.id && <div className="inline-confirm"><span>Remove this step?</span><button onClick={() => removeStep(step.id)}>Remove</button><button onClick={() => setConfirmRemove('')}>Keep</button></div>}<div className="form-stack"><Field label="Step title" required error={errors[`step-${step.id}`]}><input value={step.title} onChange={(event) => updateStep(step.id, 'title', event.target.value)} placeholder="e.g. Fold the paper support" /></Field><Field label="Instructions" required error={errors[`instruction-${step.id}`]}><textarea rows={2} value={step.instructions} onChange={(event) => updateStep(step.id, 'instructions', event.target.value)} placeholder="Tell the learner what to do, one action at a time." /></Field><Field label="Expected result"><input value={step.expected || ''} onChange={(event) => updateStep(step.id, 'expected', event.target.value)} placeholder="What should they see when this is done?" /></Field><Field label="Self-check"><input value={step.verification || ''} onChange={(event) => updateStep(step.id, 'verification', event.target.value)} placeholder="What can the learner check for themselves?" /></Field><Field label="Reference image URL" hint="Optional"><input type="url" value={step.image || ''} onChange={(event) => updateStep(step.id, 'image', event.target.value)} placeholder="https://example.com/reference.jpg" /></Field><details className="optional-step-fields"><summary>Safety note and retry tip <ChevronDown size={15} /></summary><div className="form-two-col"><Field label="Safety note"><input value={step.safety || ''} onChange={(event) => updateStep(step.id, 'safety', event.target.value)} placeholder="Optional" /></Field><Field label="Retry tip"><input value={step.feedback || ''} onChange={(event) => updateStep(step.id, 'feedback', event.target.value)} placeholder="What might help on another try?" /></Field></div></details></div></article>)}</div>}<button className="add-step-line" onClick={addStep}><Plus size={16} /> Add another step</button></div>;
    return <div className="review-stage"><div className="review-main"><div className="review-title-row"><div><span className="eyebrow">READY FOR A QUICK REVIEW</span><h3>{project.title || 'Untitled training'}</h3><p>{project.description || 'Add a description so learners know what to expect.'}</p></div><Status tone={project.steps.length ? 'green' : 'amber'}>{project.steps.length ? 'Ready to review' : 'Needs a step'}</Status></div><div className="review-facts"><div><span>SKILL AREA</span><strong>{project.category}</strong></div><div><span>LEARNER LEVEL</span><strong>{project.level}</strong></div><div><span>ESTIMATED TIME</span><strong>{project.duration || 15} minutes</strong></div><div><span>DEMONSTRATION</span><strong>{project.demonstration?.name || 'None added'}</strong></div></div><div className="review-section"><div className="review-section-heading"><h4>Materials</h4><span>Separate with commas</span></div><input value={(project.materials || []).join(', ')} onChange={(event) => update('materials', event.target.value.split(',').map((value) => value.trim()).filter(Boolean))} placeholder="e.g. paper, masking tape, coins" /></div><div className="review-section"><div className="review-section-heading"><h4>Practice steps</h4><span>{project.steps.length} total</span></div>{project.steps.length ? <ol className="review-step-list">{project.steps.map((step) => <li key={step.id}><span className="step-number">{String(project.steps.indexOf(step) + 1).padStart(2, '0')}</span><div><strong>{step.title || 'Untitled step'}</strong><p>{step.instructions || 'Instructions not added yet.'}</p></div><CheckCircle2 size={17} /></li>)}</ol> : <p className="review-empty">Add at least one complete step before publishing.</p>}</div>{errors.publish && <p className="field-error" role="alert">{errors.publish}</p>}<p className="review-disclaimer"><ShieldCheck size={16} /> Publishing makes this guide available to practise in this browser. It does not certify that the instructions are safe or correct.</p></div><aside className={`learner-preview ${mobilePreview ? 'learner-preview-open' : ''}`}><div className="preview-header"><span className="eyebrow">LEARNER PREVIEW</span><button className="preview-close icon-button" aria-label="Close learner preview" onClick={() => setMobilePreview(false)}><X size={17} /></button><div className="preview-mark"><BookOpen size={19} /></div><span className="preview-step-label">STEP 01 / {String(project.steps.length || 1).padStart(2, '0')}</span><h4>{project.steps[0]?.title || 'Your first step'}</h4><p>{project.steps[0]?.instructions || 'The learner will see concise instructions here.'}</p></div><div className="preview-check"><strong>Expected result</strong><p>{project.steps[0]?.expected || 'Add a result to show what the learner should look for.'}</p></div><div className="preview-foot"><span><Clock3 size={14} /> About {project.duration || 15} min</span><Button icon={ArrowRight} onClick={() => setMobilePreview(false)}>Next step</Button></div></aside></div>;
  };

  return <><PageHeading eyebrow={initialProject ? 'EDIT YOUR GUIDE' : 'NEW TRAINING'} title={initialProject ? 'Shape the details.' : 'Let’s make something teachable.'} description="A clear guide starts with one useful skill and a few steps." action={<button className="text-button builder-save-top" onClick={() => save('draft')}><Save size={16} /> Save draft</button>} /><div className="wizard-progress" aria-label={`Step ${stage + 1} of 4`}><div className="wizard-track">{WIZARD_STEPS.map((label, index) => <button key={label} className={`wizard-node ${stage === index ? 'wizard-node-active' : ''} ${stage > index ? 'wizard-node-done' : ''}`} onClick={() => { if (index < stage) setStage(index); else if (index === stage + 1) goNext(); }}><span className="wizard-node-number">{stage > index ? <Check size={14} /> : `0${index + 1}`}</span><span>{label}</span></button>)}</div></div><section className="builder-panel"><div className="builder-panel-heading"><div><span className="eyebrow">STEP {String(stage + 1).padStart(2, '0')} OF 04</span><h2>{['Describe the skill', 'Add a demonstration', 'Make the steps clear', 'Review your guide'][stage]}</h2><p>{['Start with the task and who it is for.', 'Choose a local reference or a sample. This demo does not upload media.', 'Edit each action, expected result, and self-check.', 'Check the details before saving or making this guide available.'][stage]}</p></div>{stage === 2 && <button className="mobile-preview-toggle" onClick={() => setMobilePreview(true)}><BookOpen size={16} /> Preview</button>}</div><div className={`builder-content ${stage === 2 ? 'builder-content-editor' : ''}`}>{stageContent()}</div><div className="builder-footer"><button className="text-button" onClick={() => stage === 0 ? navigate('/dashboard') : setStage(stage - 1)}>{stage === 0 ? <ArrowLeft size={16} /> : <ArrowLeft size={16} />} {stage === 0 ? 'Back to overview' : 'Previous'}</button>{stage < 3 ? <Button icon={ArrowRight} onClick={goNext}>Continue</Button> : <div className="builder-final-actions"><Button variant="secondary" onClick={() => save('draft')}>Save draft</Button><Button icon={Check} onClick={() => save('published')}>Publish locally</Button></div>}</div></section></>;
}

function Field({ label, required = false, hint, error, children }) {
  return <label className={`field ${error ? 'field-invalid' : ''}`}><span className="field-label">{label}{required && <span className="required-mark"> *</span>}{hint && <small>{hint}</small>}</span>{children}{error && <span className="field-error" role="alert">{error}</span>}</label>;
}

function TrainingDetail({ project, store, onDuplicate }) {
  const session = store.sessions[project.id];
  const done = session?.results?.filter((result) => result.status === 'completed').length || 0;
  const pct = project.steps.length ? Math.round((done / project.steps.length) * 100) : 0;
  const isSample = project.source === 'sample';
  return <><button className="back-link" onClick={() => navigate('/library')}><ArrowLeft size={16} /> Back to training</button><div className="detail-hero"><div className="detail-hero-copy"><div className="detail-status-row"><Status tone={project.status === 'draft' ? 'amber' : 'green'}>{project.status === 'draft' ? 'Draft' : 'Ready to practise'}</Status>{isSample && <span className="sample-only-label">Sample guide</span>}</div><h1>{project.title || 'Untitled training'}</h1><p>{project.description || 'Add a short description to help learners understand this task.'}</p><div className="detail-meta"><span><Layers3 size={16} /> {project.category || 'Uncategorized'}</span><span><Clock3 size={16} /> {project.duration || 15} min</span><span><ListChecks size={16} /> {project.steps.length} steps</span></div><div className="detail-actions"><Button icon={Play} disabled={!project.steps.length} onClick={() => navigate(`/learn/${project.id}`)}>{session && !session.completed ? 'Resume practice' : 'Start practice'}</Button>{!isSample && <><Button variant="secondary" icon={Settings2} onClick={() => navigate(`/create/${project.id}`)}>Edit guide</Button><button className="icon-button bordered-icon" aria-label="Duplicate training" title="Duplicate training" onClick={() => onDuplicate({ ...structuredClone(project), id: createId(), title: `${project.title} copy`, status: 'draft', source: 'user', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })}><Copy size={17} /></button></>}</div></div><div className="detail-hero-art"><div className="detail-art-photo" /><span className="detail-art-caption">{isSample ? 'SAMPLE WALKTHROUGH' : `${project.level || 'Beginner'} · ${project.category || 'PRACTICE'}`}</span></div></div><div className="detail-layout"><section className="detail-steps-section"><div className="section-heading"><div><span className="eyebrow">THE PRACTICE PATH</span><h2>What you’ll do</h2></div><span className="step-count-label">{project.steps.length} steps</span></div>{project.steps.length ? <div className="detail-step-list">{project.steps.map((step, index) => <article className="detail-step-row" key={step.id}><span className="detail-step-number">{String(index + 1).padStart(2, '0')}</span><div className="detail-step-copy"><h3>{step.title || `Step ${index + 1}`}</h3><p>{step.instructions || 'Instructions will be added soon.'}</p>{step.expected && <div className="detail-expected"><CheckCircle2 size={15} /><span><strong>Look for:</strong> {step.expected}</span></div>}</div><span className={`step-completion-mark ${session?.results?.[index]?.status === 'completed' ? 'step-completion-done' : ''}`}>{session?.results?.[index]?.status === 'completed' ? <Check size={15} /> : index + 1}</span></article>)}</div> : <div className="review-empty">No steps yet. Edit this guide to add its practice path.</div>}</section><aside className="detail-aside"><div className="detail-progress-panel"><span className="eyebrow">YOUR PRACTICE</span><div className="detail-progress-number">{pct}<small>%</small></div><p>{session ? `${done} of ${project.steps.length} steps self-checked` : 'No practice session yet.'}</p><div className="progress-track"><span style={{ width: `${pct}%` }} /></div><span className="assessment-note">Self-reported progress only</span></div><div className="materials-panel"><h3><FolderOpen size={17} /> You’ll need</h3>{project.materials?.length ? <ul>{project.materials.map((material) => <li key={material}><CheckCircle2 size={15} />{material}</li>)}</ul> : <p>No materials listed.</p>}</div>{session?.completed && <Button variant="secondary" icon={BadgeCheck} onClick={() => navigate(`/report/${project.id}`)}>View practice summary</Button>}</aside></div></>;
}

function LearnerMode({ project, routeStep, store, setStore }) {
  const session = store.sessions[project.id] || { currentIndex: 0, results: [], attempts: 0, completed: false };
  const startsFresh = routeStep === null && session.completed;
  const currentIndex = Math.min(Math.max(routeStep ?? (startsFresh ? 0 : session.currentIndex ?? 0), 0), Math.max(project.steps.length - 1, 0));
  const step = project.steps[currentIndex];
  const [evidenceName, setEvidenceName] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [message, setMessage] = useState('');
  const result = session.results?.[currentIndex];
  const isSample = project.source === 'sample';

  useEffect(() => {
    if (!startsFresh) return;
    setStore((current) => {
      if (!current.sessions[project.id]?.completed) return current;
      return { ...current, sessions: { ...current.sessions, [project.id]: { currentIndex: 0, results: [], attempts: 0, completed: false } } };
    });
  }, [project.id, setStore, startsFresh]);

  const updateSession = (patch) => setStore((current) => ({ ...current, sessions: { ...current.sessions, [project.id]: { ...session, ...patch } } }));
  const recordResult = (status) => {
    const results = [...(session.results || [])];
    results[currentIndex] = { status, updatedAt: new Date().toISOString(), evidenceName };
    updateSession({ results, attempts: (session.attempts || 0) + 1, currentIndex, completed: false });
    setMessage(status === 'completed' ? 'Self-check saved. No image analysis was performed.' : status === 'retry' ? 'That’s useful to notice. Review the tip, then give this step another try.' : 'No assessment was made. You can continue or try this step again with a clearer view.');
  };
  const goTo = (index) => { updateSession({ currentIndex: index }); navigate(`/learn/${project.id}/${index}`); setMessage(''); };
  const finish = () => { updateSession({ completed: true, currentIndex }); navigate(`/report/${project.id}`); };

  if (!step) return <div className="learner-no-steps"><button className="back-link" onClick={() => navigate(`/detail/${project.id}`)}><ArrowLeft size={16} /> Back to guide</button><h1>This guide is not ready to practise.</h1><p>Add a practice step before starting a session.</p></div>;

  return <div className="learner-view"><header className="learner-topbar"><a className="learner-brand" href="#/dashboard"><span className="brand-mark"><span /><span /><span /></span> skillmirror</a><div className="learner-title"><span>{project.title}</span><span className="learner-title-divider">·</span><span>Practice mode</span></div><button className="learner-exit" onClick={() => navigate(`/detail/${project.id}`)}><span>Save & exit</span><X size={17} /></button></header><div className="learner-layout"><aside className="learner-rail"><div className="rail-heading"><span className="eyebrow">YOUR PRACTICE PATH</span><strong>{project.steps.length} steps</strong></div><div className="rail-progress"><div className="progress-track"><span style={{ width: `${Math.round(((session.results || []).filter((item) => item?.status === 'completed').length / project.steps.length) * 100)}%` }} /></div><span>{(session.results || []).filter((item) => item?.status === 'completed').length} of {project.steps.length} checked</span></div><div className="rail-step-list">{project.steps.map((item, index) => { const itemResult = session.results?.[index]; return <button className={`rail-step ${index === currentIndex ? 'rail-step-active' : ''}`} key={item.id} onClick={() => goTo(index)}><span className={`rail-step-marker ${itemResult?.status === 'completed' ? 'rail-step-complete' : itemResult?.status === 'retry' ? 'rail-step-retry' : ''}`}>{itemResult?.status === 'completed' ? <Check size={13} /> : String(index + 1).padStart(2, '0')}</span><span>{item.title || `Step ${index + 1}`}</span>{itemResult?.status === 'retry' && <span className="sr-only">Needs another try</span>}</button>; })}</div><div className="rail-safety"><ShieldCheck size={16} /><span>Move at your own pace. Pause if something feels unsafe.</span></div></aside><main className="learner-main"><div className="learner-step-kicker"><span>STEP {String(currentIndex + 1).padStart(2, '0')}</span><span className="kicker-line" /><span>{String(project.steps.length).padStart(2, '0')}</span><span className="kicker-spacer" />{isSample && <span className="sample-only-label">Sample guide</span>}</div><div className="learner-step-layout"><article className="learner-instructions"><span className="eyebrow">TAKE IT ONE STEP AT A TIME</span><h1>{step.title}</h1><p className="learner-instruction-text">{step.instructions}</p>{step.safety && <div className="safety-note"><ShieldCheck size={18} /><div><strong>Take care</strong><p>{step.safety}</p></div></div>}<div className="expected-panel"><div className="expected-icon"><CheckCircle2 size={18} /></div><div><strong>What to look for</strong><p>{step.expected || 'Pause and check your work before moving on.'}</p></div></div><div className="self-check-panel"><span className="eyebrow">YOUR SELF-CHECK</span><p>{step.verification || 'Does your result match the expected result above?'}</p>{result && <div className={`learner-result learner-result-${result.status}`} role="status"><span className="result-mark">{result.status === 'completed' ? <Check size={14} /> : result.status === 'retry' ? <RotateCcw size={14} /> : <CircleHelp size={14} />}</span><span><strong>{result.status === 'completed' ? 'Marked complete' : result.status === 'retry' ? 'Try this step again' : 'Unable to assess'}</strong><small>{result.status === 'completed' ? 'Based on your self-check. No automated verification.' : result.status === 'retry' ? (step.feedback || 'Review the expected result and adjust your approach.') : 'Evidence was not analysed. Ask an instructor or continue practising.'}</small></span></div>}{message && <p className="learner-live-message" role="status">{message}</p>}<div className="checkpoint-actions"><Button icon={Check} onClick={() => recordResult('completed')}>{result?.status === 'completed' ? 'Update self-check' : 'I’m ready to continue'}</Button><button className="text-button help-trigger" onClick={() => setShowHelp(!showHelp)}><CircleHelp size={16} /> I need help</button></div>{showHelp && <div className="help-panel"><strong>Try a different approach</strong><p>{step.feedback || 'Review the step instructions and expected result. If you are unsure, ask an instructor before continuing.'}</p><div className="help-panel-actions"><button onClick={() => { recordResult('retry'); setShowHelp(false); }}>Mark for another try</button><button onClick={() => { recordResult('unable'); setShowHelp(false); }}>I can’t tell yet</button></div></div>}<label className="evidence-link"><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setEvidenceName(file.name); recordResult('unable'); } }} /><ImagePlus size={16} /> Add a photo for your own reference <span>(not analysed)</span></label>{evidenceName && <span className="evidence-filename">{evidenceName}</span>}</div></article><aside className="learner-visual"><div className={`learner-photo ${step.image ? '' : 'learner-photo-empty'}`} style={step.image ? { backgroundImage: `url("${step.image}")` } : {}} role="img" aria-label={step.image ? `Reference image for ${step.title}` : 'No reference image added'}>{!step.image && <div className="reference-placeholder"><BookOpen size={23} /><span>No reference image</span><small>Add one when editing this guide.</small></div>}<span className="reference-tag"><BookOpen size={14} /> REFERENCE</span></div><div className="visual-caption"><span>{project.category || 'PRACTICE'}</span><p>Use this as a guide, then check your own result.</p></div></aside></div><footer className="learner-footer"><button className="learner-previous" onClick={() => currentIndex > 0 ? goTo(currentIndex - 1) : navigate(`/detail/${project.id}`)}><ArrowLeft size={17} /><span>{currentIndex > 0 ? 'Previous step' : 'Exit practice'}</span></button><div className="learner-footer-progress"><div className="progress-track"><span style={{ width: `${((currentIndex + 1) / project.steps.length) * 100}%` }} /></div><span>{currentIndex + 1} of {project.steps.length}</span></div>{currentIndex < project.steps.length - 1 ? <Button icon={ArrowRight} onClick={() => goTo(currentIndex + 1)}>Next step</Button> : <Button icon={Check} onClick={finish}>Finish practice</Button>}</footer></main></div></div>;
}

function AssessmentReport({ project, store }) {
  const session = store.sessions[project.id] || { results: [], attempts: 0 };
  const completed = project.steps.filter((_step, index) => session.results?.[index]?.status === 'completed').length;
  const needsRetry = project.steps.filter((_step, index) => session.results?.[index]?.status === 'retry').length;
  const unable = project.steps.filter((_step, index) => session.results?.[index]?.status === 'unable').length;
  const percent = project.steps.length ? Math.round((completed / project.steps.length) * 100) : 0;
  return <div className="report-view"><header className="report-header"><a className="learner-brand" href="#/dashboard"><span className="brand-mark"><span /><span /><span /></span> skillmirror</a><button className="learner-exit" onClick={() => navigate(`/detail/${project.id}`)}>Back to training <ArrowRight size={16} /></button></header><main className="report-main"><button className="back-link" onClick={() => navigate(`/detail/${project.id}`)}><ArrowLeft size={16} /> Training details</button><div className="report-heading"><div><span className="eyebrow">PRACTICE SUMMARY</span><h1>Good work showing up.</h1><p>{project.title} · {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p></div><div className="report-ring" aria-label={`${percent}% of steps marked complete`}><strong>{percent}<small>%</small></strong><span>self-checked</span></div></div><div className="report-caveat"><ShieldCheck size={18} /><p><strong>This is a practice record, not a skills assessment.</strong> Completion reflects steps you marked as done. No image or video was analysed.</p></div><div className="report-metrics"><div><span className="metric-icon metric-green"><Check size={17} /></span><strong>{completed}</strong><small>Marked complete</small></div><div><span className="metric-icon metric-amber"><RotateCcw size={17} /></span><strong>{needsRetry}</strong><small>Another try</small></div><div><span className="metric-icon metric-neutral"><CircleHelp size={17} /></span><strong>{unable}</strong><small>Not assessed</small></div></div><section className="report-step-section"><div className="section-heading"><div><span className="eyebrow">STEP BY STEP</span><h2>Keep building from here.</h2></div><span className="attempt-note">{session.attempts || 0} self-checks recorded</span></div><div className="report-steps">{project.steps.map((step, index) => { const status = session.results?.[index]?.status; const complete = status === 'completed'; const retry = status === 'retry'; return <article className="report-step" key={step.id}><span className={`report-step-icon ${complete ? 'report-step-icon-green' : retry ? 'report-step-icon-amber' : ''}`}>{complete ? <Check size={16} /> : retry ? <RotateCcw size={16} /> : String(index + 1).padStart(2, '0')}</span><div className="report-step-copy"><span className="eyebrow">STEP {String(index + 1).padStart(2, '0')}</span><h3>{step.title}</h3><p>{complete ? 'You marked this step complete. Take a moment to compare your result with the expected outcome.' : retry ? (step.feedback || 'Review the expected result and try this step again.') : status === 'unable' ? 'This step was not assessed. Ask for another explanation or practise it again.' : 'Not marked complete in this session. You can return and practise it.'}</p></div><div className="report-step-actions"><Status tone={complete ? 'green' : retry ? 'amber' : 'neutral'}>{complete ? 'Self-checked' : retry ? 'Try again' : status === 'unable' ? 'Not assessed' : 'Not started'}</Status><button className="icon-button" aria-label={`${retry ? 'Retry' : 'Practise'} ${step.title}`} onClick={() => navigate(`/learn/${project.id}/${index}`)}><RotateCcw size={16} /></button></div></article>; })}</div></section><div className="report-footer"><Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/dashboard')}>Back to overview</Button><Button icon={RotateCcw} onClick={() => navigate(`/learn/${project.id}`)}>Practise again</Button></div></main></div>;
}

export default App;
