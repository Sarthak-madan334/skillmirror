import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Play, Sparkles } from 'lucide-react';

const phases = [
  ['DESCRIBE', 'Turn a task into a guide', 'Make a clear learning path from what you already know.'],
  ['BUILD STEPS', 'Break it into checkpoints', 'Each step gets an instruction, expected result, and self-check.'],
  ['PRACTISE', 'Follow one step at a time', 'Learners focus, reflect, and keep their momentum.'],
  ['IMPROVE', 'See what to try next', 'A simple practice record makes progress visible.'],
];

export default function LandingPage({ onNavigate }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => { const timer = setInterval(() => setPhase((value) => (value + 1) % phases.length), 3600); return () => clearInterval(timer); }, []);
  const current = phases[phase];
  return <main className="cinematic-landing">
    <nav className="cinematic-nav"><a className="cinematic-brand" href="#/landing"><span className="cinematic-mark"><i /><i /><i /></span>skillmirror</a><div><a href="#how-it-works">How it works</a><button onClick={() => onNavigate('/create')}>Start building <ArrowRight size={14} /></button></div></nav>
    <section className="cinematic-hero"><div className="cinematic-orbit cinematic-orbit-a" /><div className="cinematic-orbit cinematic-orbit-b" /><div className="cinematic-copy"><span className="cinematic-kicker"><Sparkles size={14} /> INTRODUCING SKILLMIRROR</span><h1>Practice<br /><em>with purpose.</em></h1><p>A skill. A guide. A better way to learn by doing.</p><div className="cinematic-actions"><button onClick={() => onNavigate('/create')}>Make a practice guide <ArrowRight size={16} /></button><a href="#how-it-works"><Play size={15} /> See how it works</a></div><div className="cinematic-proof"><span><CheckCircle2 size={14} /> Step-by-step guidance</span><span><CheckCircle2 size={14} /> Human-friendly feedback</span></div></div><div className="cinematic-demo" aria-label={`Product demo: ${current[0].toLowerCase()}`}><div className="cinematic-demo-top"><span /> LIVE PRODUCT TOUR <b>0{phase + 1}<small> / 04</small></b></div><div className="cinematic-window"><div className="cinematic-window-bar"><i /><i /><i /><small>skillmirror / practice studio</small></div><div className="cinematic-window-body"><aside><i /><i /><i /><i /></aside><div><label>{current[0]}</label><h2>{current[1]}</h2><p>{current[2]}</p><span className="cinematic-progress"><i style={{ width: `${((phase + 1) / phases.length) * 100}%` }} /></span><footer>Checkpoint {phase + 1}<em>{phase === 2 ? 'In practice' : 'Ready'}</em></footer></div></div></div><div className="cinematic-caption"><small>WATCH IT TAKE SHAPE</small><strong>{current[0].toLowerCase()} → practise with purpose</strong></div><div className="cinematic-dots">{phases.map((item, index) => <i key={item[0]} className={index === phase ? 'active' : ''} />)}</div></div></section>
    <section id="how-it-works" className="cinematic-story"><span>FROM KNOW-HOW TO DOING</span><h2>A better way to pass on<br />the things worth knowing.</h2><div><article><b>01</b><h3>Capture the method</h3><p>Describe the task and attach a demonstration when it helps.</p></article><article><b>02</b><h3>Shape the checkpoints</h3><p>Turn a messy process into focused steps and self-checks.</p></article><article><b>03</b><h3>Practise with purpose</h3><p>Follow the guide, reflect on the attempt, and improve.</p></article></div></section>
  </main>;
}
