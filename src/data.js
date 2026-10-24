export const EXAMPLE_ID = 'example-paper-bridge';

export const EXAMPLE_TRAINING = {
  id: EXAMPLE_ID,
  title: 'Build a paper bridge',
  description: 'Explore how simple folds can make a sheet of paper strong enough to span a small gap.',
  category: 'Maker skills',
  level: 'Beginner',
  duration: 12,
  objectives: 'Build a stable bridge and test how its shape affects strength.',
  materials: ['2 sheets of paper', 'Masking tape', 'A few coins', 'Two sturdy books'],
  status: 'published',
  source: 'sample',
  demonstration: { mode: 'sample', name: 'Paper bridge demonstration (sample)' },
  steps: [
    {
      id: 'bridge-step-1',
      title: 'Set up the span',
      instructions: 'Place two books parallel to each other with a small gap between them. Keep the tops level.',
      expected: 'The books form a steady, even gap for your bridge.',
      verification: 'Check that both book edges are level and the gap is clear.',
      safety: '',
      image: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=1200&q=82',
      feedback: 'Try bringing the books closer together and check that neither one rocks.',
    },
    {
      id: 'bridge-step-2',
      title: 'Fold the support',
      instructions: 'Fold one sheet of paper back and forth into an accordion shape. Make each fold about two fingers wide.',
      expected: 'The folded paper stands up in repeating ridges without unfolding.',
      verification: 'Look along the paper edge: the ridges should be similar in height.',
      safety: '',
      image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=82',
      feedback: 'Open the sheet and refold it with wider, more even sections.',
    },
    {
      id: 'bridge-step-3',
      title: 'Place the bridge deck',
      instructions: 'Rest the second sheet across the folded support, then set the support between the books.',
      expected: 'The flat sheet reaches both books and the folded support sits underneath its center.',
      verification: 'Check that the paper touches both book tops and the folds face upward.',
      safety: '',
      image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=82',
      feedback: 'Center the folded support and make sure the top sheet overlaps each book.',
    },
    {
      id: 'bridge-step-4',
      title: 'Test the bridge gently',
      instructions: 'Add one coin at a time near the middle. Stop if the paper slips or the bridge bends sharply.',
      expected: 'The bridge stays across the gap as you add a few coins.',
      verification: 'Notice where the bridge bends and remove the coins before changing the design.',
      safety: 'Keep the test low over a clear surface and use only a few lightweight coins.',
      image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=82',
      feedback: 'Remove the coins, check that the support is centered, then try again with one coin.',
    },
  ],
};

export function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `training-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createBlankTraining() {
  return {
    id: createId(),
    title: '',
    description: '',
    category: 'Maker skills',
    level: 'Beginner',
    duration: 15,
    objectives: '',
    materials: [],
    status: 'draft',
    source: 'user',
    demonstration: null,
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createSampleSteps() {
  return EXAMPLE_TRAINING.steps.map((step) => ({
    ...step,
    id: createId(),
    image: '',
  }));
}